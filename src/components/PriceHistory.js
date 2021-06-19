import React, { useEffect, useState } from "react";
import "chartjs-adapter-moment";

import { Line } from "react-chartjs-2";
import { useAccount } from "../data/account";
import { LsKey, NearConfig } from "../data/near";
import { mapSale } from "../data/sales";
import { useToken } from "../data/token";
import { fromTokenBalance } from "../data/utils";
import ls from "local-storage";

const UnknownHistorySize = 24 * 4;
const MaxHistorySize = 24 * 14;
const MaxNumberToDisplay = 48;
const BlockInterval = 3600;
const truncBlockHeight = (h) => Math.trunc(h / BlockInterval) * BlockInterval;

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

  const [historicSales, setHistoricSales] = useState(false);

  const account = useAccount();
  useEffect(() => {
    if (historicSales === false && account && account.near) {
      setHistoricSales([]);
      const fetchHistoricData = async () => {
        const near = account.near;
        const currentHeight = sale.endBlockHeight || sale.currentBlockHeight;
        const firstBlockHeight = Math.max(
          currentHeight - BlockInterval * MaxHistorySize,
          sale.startBlockHeight ||
            currentHeight - BlockInterval * UnknownHistorySize
        );
        let height = truncBlockHeight(currentHeight);
        const step =
          BlockInterval *
          Math.max(
            1,
            Math.trunc(
              Math.trunc((height - firstBlockHeight) / BlockInterval) /
                MaxNumberToDisplay
            )
          );
        const sales = [];
        while (height > firstBlockHeight) {
          const promises = [];
          for (let i = 0; i < 10 && height > firstBlockHeight; ++i) {
            promises.push(fetchHistoricSale(near, sale.saleId, height));
            height -= step;
          }
          sales.push(...(await Promise.all(promises)));
          setHistoricSales(sales);
        }
      };
      fetchHistoricData();
    }
  }, [historicSales, account, sale]);

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

      const inAmount = fromTokenBalance(inToken, sale.inTokenRemaining);
      const outAmount = fromTokenBalance(outToken, sale.outTokens[0].remaining);
      const price = outAmount.gt(0) ? inAmount.div(outAmount) : null;

      if (price) {
        labels.push(x);
        data.push(price.toNumber());
      }
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
          time: {
            minUnit: "hour",
          },
          ticks: {
            major: {
              enabled: true,
            },
          },
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
