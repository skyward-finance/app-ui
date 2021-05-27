import "./RemainingDuration.scss";
import { dateToString } from "../data/utils";
import Timer from "react-compound-timer";
import React from "react";

export default function RemainingDuration(props) {
  const sale = props.sale;
  const progress = Math.trunc(
    (1 - sale.remainingDuration / sale.duration) * 100
  );
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
          className="progress-bar progress-bar-striped bg-success"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          {progress}%
        </div>
      </div>
      <div className="text-center">
        Remaining{" "}
        <Timer
          initialTime={sale.remainingDuration}
          direction="backward"
          timeToUpdate={100}
          lastUnit="d"
          checkpoints={[
            {
              time: 0,
            },
          ]}
        >
          {() => (
            <React.Fragment>
              <Timer.Days
                formatValue={(v) => (v > 1 ? `${v} days ` : v ? `1 day ` : "")}
              />
              <Timer.Hours />:
              <Timer.Minutes formatValue={(v) => `${v}`.padStart(2, "0")} />
              :
              <Timer.Seconds formatValue={(v) => `${v}`.padStart(2, "0")} />
            </React.Fragment>
          )}
        </Timer>
      </div>
    </div>
  );
}
