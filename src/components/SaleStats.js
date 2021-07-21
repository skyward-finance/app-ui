import React, {useEffect, useState} from "react";

const fetch = require("node-fetch");

export default function SaleRate(props) {
    const [participants, setParticipants] = useState(0);

    useEffect(() => {
        const sale = props.sale;

        let request = {
            "user": "public_readonly",
            "host": "104.199.89.51",
            "database": "mainnet_explorer",
            "password": "nearprotocol",
            "port": 5432,
            "parameters": [
                sale.saleId
            ],
            "query": "SELECT COUNT(DISTINCT receipt_predecessor_account_id) as total_participants FROM action_receipt_actions WHERE action_receipt_actions.receipt_receiver_account_id = 'skyward.near' AND ((action_receipt_actions.args->'args_json')->>'sale_id')::int = $1 AND action_receipt_actions.args->>'method_name' = 'sale_deposit_in_token'"
       };

        fetch(`https://rest.nearapi.org/explorer`, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-type': 'application/json; charset=UTF-8'
            }
        })
            .then(res => {
                return res.json().then(response => {
                    setParticipants(Number(response[0]["total_participants"]));
                });
            });
    });

    return (
        <>
            {participants > 0 && <div>Total participants: {participants}</div>}
        </>
    );
}
