import React from "react";
import useSWR from "swr";

const statsFetcher = async (_key, saleId) => {
  let request = {
    user: "public_readonly",
    host: "mainnet.db.explorer.indexer.near.dev",
    database: "mainnet_explorer",
    password: "nearprotocol",
    port: 5432,
    parameters: [saleId],
    query:
      "SELECT COUNT(DISTINCT receipt_predecessor_account_id) as total_participants FROM action_receipt_actions WHERE action_receipt_actions.receipt_receiver_account_id = 'skyward.near' AND ((action_receipt_actions.args->'args_json')->>'sale_id')::int = $1 AND action_receipt_actions.args->>'method_name' = 'sale_deposit_in_token'",
  };

  const res = await fetch(`https://rest.nearapi.org/explorer`, {
    method: "POST",
    body: JSON.stringify(request),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  });

  const response = await res.json();

  return parseInt(response[0]["total_participants"], 10);
};

export default function SaleRate(props) {
  const { data: participants } = useSWR(
    ["participants", props.sale.saleId],
    statsFetcher
  );

  return (
    <div>
      Total number of participants: {participants >= 0 ? participants : "???"}
    </div>
  );
}
