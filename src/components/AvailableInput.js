import { bigToString } from "../data/utils";
import Big from "big.js";
import React, { useState } from "react";
import uuid from "react-uuid";

export default function AvailableInput(props) {
  const [inputId] = useState(uuid());
  const [isMax, setIsMax] = useState(false);
  const limit = props.limit;
  const value = props.value;
  const setValue = props.setValue;

  const [innerValue, setInnerValue] = useState(value);

  if (isMax && !limit.eq(value || Big(0))) {
    setTimeout(() => {
      setInnerValue(limit);
      setValue(limit);
    }, 1);
  }

  return (
    <div className="input-group mb-3">
      <div className="form-floating" style={{ flex: "1 1 auto", width: "1%" }}>
        <input
          className="form-control"
          type="number"
          input={inputId}
          placeholder={"1"}
          value={innerValue || ""}
          onChange={(e) => {
            e.preventDefault();
            setIsMax(false);
            let v = value;
            const nv = e.target.value;
            if (nv.length > 0) {
              try {
                v = Big(nv);
                if (v.lt(0)) {
                  v = v.mul(-1);
                  setInnerValue(v);
                } else {
                  setInnerValue(nv);
                }
              } catch (e) {
                setInnerValue(value);
              }
            } else {
              v = null;
              setInnerValue(nv);
            }
            setValue(v);
          }}
        />
        <label htmlFor={inputId}>Available {bigToString(limit)}</label>
      </div>
      <button
        className="btn btn-outline-secondary"
        type="button"
        onClick={() => setIsMax(true)}
      >
        MAX
      </button>
    </div>
  );
}
