import "./RemainingDuration.scss";
import { dateToString } from "../data/utils";
import Timer from "react-compound-timer";
import React from "react";

export default function RemainingDuration(props) {
  const sale = props.sale;
  const progress = sale.started()
    ? Math.trunc((1 - sale.remainingDuration / sale.duration) * 100)
    : 0;

  // const coolDown = Math.max(remainingDuration - refreshRate, 0) + ;
  //       callback: () =>
  //         setTimeout(
  //           async () => {
  //             await sales.refreshSale(sale.saleId);
  //           },
  //           sale.started() ? 500 : 2000
  //         ),
  //     },

  const remainingDuration = sale.started()
    ? sale.remainingDuration
    : sale.startDate - new Date().getTime();
  return (
    <div>
      <div className="clearfix">
        <div className="float-start duration-date">
          {dateToString(sale.startDate)}
        </div>
        <div className="float-end duration-date">
          {dateToString(sale.endDate)}
        </div>
      </div>
      <div className="progress">
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ minWidth: `${progress}%` }}
        >
          {sale.started() && <div>{progress}%</div>}
        </div>
      </div>
      <div className="text-center">
        {sale.ended() ? (
          "Sale has ended"
        ) : (
          <div>
            {sale.started() ? "Sale end in" : "Sale starts in"}{" "}
            <Timer
              key={`${sale.saleId}-${remainingDuration}`}
              initialTime={remainingDuration}
              direction="backward"
              timeToUpdate={100}
              lastUnit="d"
            >
              {() => (
                <React.Fragment>
                  <Timer.Days
                    formatValue={(v) =>
                      v > 1 ? `${v} days ` : v ? `1 day ` : ""
                    }
                  />
                  <Timer.Hours />:
                  <Timer.Minutes formatValue={(v) => `${v}`.padStart(2, "0")} />
                  :
                  <Timer.Seconds formatValue={(v) => `${v}`.padStart(2, "0")} />
                </React.Fragment>
              )}
            </Timer>
          </div>
        )}
      </div>
    </div>
  );
}
