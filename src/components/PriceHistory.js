import React, { useEffect, useState } from "react";
import "chartjs-adapter-moment";

import { Line } from "react-chartjs-2";
import { useAccount } from "../data/account";
import { LsKey, NearConfig } from "../data/near";
import { mapSale } from "../data/sales";
import { useToken } from "../data/token";
import { fromTokenBalance } from "../data/utils";
import ls from "local-storage";

const fetchHistoricSale = async (near, saleId, blockId) => {
  const lsKey = `${LsKey}hs:${saleId}:${blockId}`;
  let sale = ls.get(lsKey);
  if (sale) {
    return mapSale(sale);
  }
  sale = await near
    .archivalViewCall(blockId, NearConfig.contractName, "get_sale", {
      sale_id: saleId,
    })
    .catch((e) => false);
  if (sale !== false) {
    ls.set(lsKey, sale);
    if (sale) {
      sale = mapSale(sale);
    }
  }
  return sale;
};

export default function PriceHistory(props) {
  const sale = props.sale;
  const saleId = sale.saleId;

  const [historicSales, setHistoricSales] = useState(false);

  const account = useAccount();
  useEffect(() => {
    if (historicSales === false && account && account.near) {
      const fetchHistoricData = async () => {
        const near = account.near;
        const currentHeight = await near.fetchBlockHeight();
        const promises = [];
        for (let i = 0; i < 20; ++i) {
          const height = Math.trunc((currentHeight - 3600 * i) / 3600) * 3600;
          promises.push(fetchHistoricSale(near, saleId, height));
        }
        return await Promise.all(promises);
      };
      fetchHistoricData().then(setHistoricSales);
    }
  }, [historicSales, account, saleId]);

  const inToken = useToken(sale.inTokenAccountId);
  const outToken = useToken(sale.outTokens[0].tokenAccountId);

  let lineData = false;
  let options = false;
  if (historicSales && inToken && outToken) {
    const labels = [];
    const data = [];
    [sale, ...historicSales].reverse().forEach((sale, i) => {
      if (!sale) {
        return;
      }
      const x = sale.currentDate;
      labels.push(x);

      const inAmount = fromTokenBalance(inToken, sale.inTokenRemaining);
      const outAmount = fromTokenBalance(outToken, sale.outTokens[0].remaining);
      const price = outAmount.gt(0) ? inAmount.div(outAmount) : null;

      data.push(price.toNumber());
    });
    lineData = {
      labels,
      datasets: [
        {
          label: `${outToken.metadata.symbol} / ${inToken.metadata.symbol}`,
          data,
          fill: false,
          backgroundColor: "#8766ac",
          borderColor: "#8766ac22",
        },
      ],
    };

    options = {
      animation: false,
      responsive: true,
      scales: {
        xAxis: {
          type: "time",
        },
        yAxis: {
          ticks: {
            beginAtZero: true,
          },
        },
      },
    };
  }

  return (
    <div className="card m-2">
      <div className="card-body">
        Price history
        <br />
        <Line data={lineData} options={options} />
      </div>
    </div>
  );
}
