import React, { useState } from "react";
import { useAccount } from "../data/account";
import useSWR from "swr";
import Big from "big.js";
import uuid from "react-uuid";
import TokenBalance from "./TokenBalance";
import TokenSymbol from "./TokenSymbol";

const referralFetcher = async (_key, saleId, accountId) => {
  if (!accountId) {
    return null;
  }
  let request = {
    user: "public_readonly",
    host: "104.199.89.51",
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

  if (!(account && account.accountId)) {
    return false;
  }

  const totalDeposit = referrals
    ? referrals.reduce((s, { amount }) => s.add(amount), Big(0))
    : Big(0);

  return referrals ? (
    <>
      <div className="mb-3 mt-3">
        Total amount deposited by your referees:{" "}
        <TokenBalance
          tokenAccountId={sale.inTokenAccountId}
          balance={totalDeposit}
        />{" "}
        <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
      </div>
      {referrals.length > 0 && (
        <div className="mb-3 table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Referee account ID</th>
                <th scope="col">Amount deposited</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(({ accountId, amount }, i) => (
                <tr key={`${gkey}-ref-${accountId}`}>
                  <th scope="row">{i + 1}</th>
                  <td className="col-8">{accountId}</td>
                  <td className="col-4">
                    <TokenBalance
                      tokenAccountId={sale.inTokenAccountId}
                      balance={amount}
                    />{" "}
                    <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
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
