import React, { useState } from "react";
import { useAccount } from "../data/account";
import useSWR from "swr";
import Big from "big.js";
import uuid from "react-uuid";
import TokenBalance from "./TokenBalance";
import TokenSymbol from "./TokenSymbol";
import { useSales } from "../data/sales";

const referralFetcher = async (_key, accountId) => {
  if (!accountId) {
    return null;
  }
  let request = {
    user: "public_readonly",
    host: "104.199.89.51",
    database: "mainnet_explorer",
    password: "nearprotocol",
    port: 5432,
    parameters: [accountId],
    query:
      "select (args->'args_json'->>'sale_id')::int sale_id, predecessor_account_id, SUM(CAST(args->'args_json'->>'amount' as numeric)) amount from action_receipt_actions join receipts using(receipt_id) join execution_outcomes using(receipt_id) where action_kind = 'FUNCTION_CALL' and receiver_account_id = 'skyward.near' and args->>'method_name' = 'sale_deposit_in_token' and args->'args_json'->>'referral_id' = $1 and status = 'SUCCESS_VALUE' group by sale_id, predecessor_account_id order by sale_id, amount desc",
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
    saleId: row.sale_id,
    accountId: row.predecessor_account_id,
    amount: Big(row.amount),
  }));
};

export default function AllReferrals(props) {
  const sales = useSales();
  const account = useAccount();
  const [gkey] = useState(uuid());

  const { data: referrals } = useSWR(
    ["all-referrals", account && account.accountId],
    referralFetcher
  );

  if (!(account && account.accountId) || !sales) {
    return false;
  }

  const computeBonus = (sale, amount) =>
    sale && sale.inTokenPaid.gt(0)
      ? amount
          .mul(sale.outTokens[0].distributed.add(sale.outTokens[0].remaining))
          .div(sale.inTokenPaid)
          .mul(sale.outTokens[0].referralBpt)
          .div(20000)
      : Big(0);

  return referrals && referrals.length > 0 ? (
    <div className="card mb-2">
      <div className="card-body">
        <h2 className="primary-header">Referral bonuses</h2>
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th scope="col">Listing</th>
                <th scope="col">Referee account ID</th>
                <th scope="col">Amount deposited</th>
                <th scope="col">Estimated bonus</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(({ saleId, accountId, amount }, i) => {
                const sale = sales.sales[saleId];
                const outToken = sale && sale.outTokens[0];
                return (
                  sale && (
                    <tr key={`${gkey}-ref:${saleId}:${accountId}`}>
                      <th scope="row">{saleId}</th>
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
                          balance={computeBonus(sale, amount)}
                        />{" "}
                        <TokenSymbol tokenAccountId={outToken.tokenAccountId} />
                      </td>
                    </tr>
                  )
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
}
