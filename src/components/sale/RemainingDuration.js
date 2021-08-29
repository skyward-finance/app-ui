import "./RemainingDuration.scss";
import { dateToString } from "../../data/utils";
import Timer from "react-compound-timer";
import React from "react";

export default function RemainingDuration(props) {
  const sale = props.sale;
  const time = new Date().getTime();
  const progress = sale.started()
    ? (1 - sale.remainingDuration / sale.duration) * 100
    : ((sale.startTime - time) / (sale.endTime - time)) * 100;

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
    : sale.startDate - time;
  return (
    <div>
      <div className="duration-date-wrapper">
        <div
          className="duration-date"
          style={{
            left: sale.started() ? 0 : `min(100% - 12em, ${progress}%)`,
          }}
        >
          {dateToString(sale.startDate)}
        </div>
        <div className="duration-date" style={{ right: 0 }}>
          {dateToString(sale.endDate)}
        </div>
      </div>
      <div className="progress">
        {sale.started() ? (
          <div
            className="progress-bar bg-simple-gradient"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ minWidth: `${progress}%` }}
          >
            {sale.started() && <div>{Math.trunc(progress * 10) / 10}%</div>}
          </div>
        ) : (
          <>
            <div
              className="progress-bar bg-transparent text-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${progress}%` }}
            >
              Preparation
            </div>
            <div
              className="progress-bar bg-simple-gradient-light"
              role="progressbar"
              aria-valuenow={100 - progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${100 - progress}%` }}
            >
              Sale 0%
            </div>
          </>
        )}
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
