import React, { useEffect, useState } from "react";
import "chartjs-adapter-moment";

import { Line } from "react-chartjs-2";
import { useAccount } from "../../data/account";
import { LsKey, NearConfig } from "../../data/near";
import { mapSale } from "../../data/sales";
import { useToken } from "../../data/token";
import { fromTokenBalance } from "../../data/utils";
import ls from "local-storage";

const UnknownHistorySize = 24 * 4;
const MaxHistorySize = 24 * 14;
const MaxNumberToDisplay = 48;
const BlockInterval = 3600;
const truncBlockHeight = (h) => Math.trunc(h / BlockInterval) * BlockInterval;

const getCachedHistoricSale = (saleId, blockId) => {
  const lsKey = `${LsKey}hs:${saleId}:${blockId}`;
  let sale = ls.get(lsKey);
  if (sale !== null) {
    return sale ? mapSale(sale) : null;
  }
  return false;
};

const fetchHistoricSale = async (near, saleId, blockId) => {
  const lsKey = `${LsKey}hs:${saleId}:${blockId}`;
  let sale = await near
    .archivalViewCall(blockId, NearConfig.contractName, "get_sale", {
      sale_id: saleId,
    })
    .catch((e) => false);
  if (sale !== false) {
    ls.set(lsKey, sale || false);
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
        let promises = [];
        let needFetching = 0;
        while (height > firstBlockHeight) {
          const cachedSale = getCachedHistoricSale(sale.saleId, height);
          if (cachedSale === false) {
            promises.push(fetchHistoricSale(near, sale.saleId, height));
            ++needFetching;
          } else {
            promises.push(Promise.resolve(cachedSale));
          }
          height -= step;
          if (needFetching === 10) {
            sales.push(...(await Promise.all(promises)));
            needFetching = 0;
            promises = [];
            setHistoricSales(sales);
          }
        }
        if (promises.length > 0) {
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
  let numData = 0;
  if (historicSales && inToken && outToken) {
    const datasets = [
      {
        data: [],
        label: `Before sale started (no tokens sold) ${outToken.metadata.symbol} / ${inToken.metadata.symbol}`,
        fill: false,
        backgroundColor: "#bbbbbb",
        borderColor: "#bbbbbb22",
      },
    ];
    [sale, ...historicSales].reverse().forEach((sale, i) => {
      if (!sale) {
        return;
      }
      const x = Math.min(sale.endDate, sale.currentDate);

      const inAmount = fromTokenBalance(inToken, sale.inTokenRemaining);
      const outAmount = fromTokenBalance(outToken, sale.outTokens[0].remaining);
      const price = outAmount.gt(0) ? inAmount.div(outAmount) : null;

      if (price) {
        numData += 1;
        if (sale.started()) {
          if (datasets.length === 1) {
            datasets.push({
              data: [],
              label: `${outToken.metadata.symbol} / ${inToken.metadata.symbol}`,
              fill: false,
              backgroundColor: "#8766ac",
              borderColor: "#8766ac22",
            });
          }
        }
        datasets[sale.started() ? 1 : 0].data.push({
          x,
          y: price.toNumber(),
        });
      }
    });
    lineData = {
      datasets,
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
          min: 0,
          ticks: {
            beginAtZero: true,
          },
        },
      },
    };
  }

  return (
    lineData &&
    numData > 1 && (
      <div className="card mb-2">
        <div className="card-body">
          <div>Rate history</div>
          <Line data={lineData} options={options} />
        </div>
      </div>
    )
  );
}
