import React, { useState } from "react";
import { useAccount } from "../../data/account";
import useSWR from "swr";
import Big from "big.js";
import uuid from "react-uuid";
import TokenBalance from "../token/TokenBalance";
import TokenSymbol from "../token/TokenSymbol";

const referralFetcher = async (_key, saleId, accountId) => {
  if (!accountId) {
    return null;
  }
  let request = {
    user: "public_readonly",
    host: "mainnet.db.explorer.indexer.near.dev",
    database: "mainnet_explorer",
    password: "nearprotocol",
    port: 5432,
    parameters: [saleId, accountId],
    query:
      "select predecessor_account_id, SUM(CAST(args->'args_json'->>'amount' as numeric)) amount from action_receipt_actions join receipts using(receipt_id) join execution_outcomes using(receipt_id) where action_kind = 'FUNCTION_CALL' and receiver_account_id = 'skyward.near' and args->>'method_name' = 'sale_deposit_in_token' and (args->'args_json'->>'sale_id')::int = $1 and args->'args_json'->>'referral_id' = $2 and status = 'SUCCESS_VALUE' group by predecessor_account_id order by amount desc",
  };

  const res = await fetch(`https://rest.nearapi.org/explorer`, {
    method: "POST",
    body: JSON.stringify(request),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  });

  const response = await res.json();

  return response.map((row) => ({
    accountId: row.predecessor_account_id,
    amount: Big(row.amount),
  }));
};

export default function ReferralList(props) {
  const sale = props.sale;
  const account = useAccount();
  const [gkey] = useState(uuid());

  const { data: referrals } = useSWR(
    ["referrals", sale.saleId, account && account.accountId],
    referralFetcher
  );

  if (!(account && account.accountId) || !sale) {
    return false;
  }

  const totalDeposit = referrals
    ? referrals.reduce((s, { amount }) => s.add(amount), Big(0))
    : Big(0);

  const outToken = sale.outTokens[0];
  const referralBpt = outToken.referralBpt;

  const computeBonus = (amount) =>
    sale.inTokenPaid.gt(0)
      ? amount
          .mul(outToken.distributed.add(outToken.remaining))
          .div(sale.inTokenPaid)
          .mul(referralBpt)
          .div(20000)
      : Big(0);

  return referrals ? (
    <>
      <div className="mb-3 mt-3">
        <div className="mb-1">
          <span className="text-muted">
            Note, the estimated amounts below may be less than the actual
            amounts. The withdrawals by referees are not accounted.
          </span>
        </div>
        <div>
          Total amount deposited by your referees:{" "}
          <TokenBalance
            tokenAccountId={sale.inTokenAccountId}
            balance={totalDeposit}
          />{" "}
          <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
        </div>
        <div>
          Estimated total bonus:{" "}
          <TokenBalance
            tokenAccountId={outToken.tokenAccountId}
            balance={computeBonus(totalDeposit)}
          />{" "}
          <TokenSymbol tokenAccountId={outToken.tokenAccountId} />{" "}
        </div>
      </div>
      {referrals.length > 0 && (
        <div className="mb-3 table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Referee account ID</th>
                <th scope="col">Amount deposited</th>
                <th scope="col">Estimated bonus</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(({ accountId, amount }, i) => (
                <tr key={`${gkey}-ref-${accountId}`}>
                  <th scope="row">{i + 1}</th>
                  <td className="col-6">{accountId}</td>
                  <td className="col-3">
                    <TokenBalance
                      tokenAccountId={sale.inTokenAccountId}
                      balance={amount}
                    />{" "}
                    <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                  </td>
                  <td className="col-3">
                    <TokenBalance
                      tokenAccountId={outToken.tokenAccountId}
                      balance={computeBonus(amount)}
                    />{" "}
                    <TokenSymbol tokenAccountId={outToken.tokenAccountId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  ) : (
    <></>
  );
}
