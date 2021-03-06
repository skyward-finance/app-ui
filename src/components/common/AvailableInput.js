import { bigToString } from "../../data/utils";
import Big from "big.js";
import React, { useEffect, useState } from "react";
import uuid from "react-uuid";
import "./AvailableInput.scss";

export default function AvailableInput(props) {
  const [inputId] = useState(props.id || uuid());
  const [isMax, setIsMax] = useState(false);
  const limit = props.limit;
  const value = props.value;
  const setValue = props.setValue;

  const [lastExternalValue, setLastExternalValue] = useState(value);
  const [innerValue, setInnerValue] = useState(value);

  useEffect(() => {
    if (
      value !== lastExternalValue &&
      (!value || !lastExternalValue || !Big(value).eq(lastExternalValue))
    ) {
      setIsMax(false);
      setLastExternalValue(value);
      if (!value || !innerValue || !Big(value).eq(Big(innerValue) || Big(0))) {
        setInnerValue(value);
      }
    }
  }, [value, lastExternalValue, innerValue]);

  useEffect(() => {
    if (limit) {
      const roundLimit = limit.round(6, 0);
      if (isMax && !roundLimit.eq(value || Big(0))) {
        setInnerValue(roundLimit);
        setLastExternalValue(roundLimit);
        setValue(roundLimit);
      }
    }
  }, [isMax, value, limit, setValue]);

  const isInvalid = (limit || Big(0)).lt(value || Big(0));
  return (
    <div
      className={`available-input input-group mb-3 ${
        props.large ? "input-group-lg" : ""
      } ${props.className || ""}`}
    >
      <div className="form-floating" style={{ flex: "1 1 auto", width: "1%" }}>
        <input
          id={inputId}
          disabled={props.disabled}
          autoFocus={props.autoFocus}
          className={`form-control ${
            props.large ? "form-control-lg" : ""
          } font-monospace fw-bold ${isInvalid ? "is-invalid" : ""}`}
          max={(limit || Big(0)).toNumber()}
          style={{ minWidth: "10em" }}
          type="number"
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
            setLastExternalValue(value);
            setValue(v);
          }}
        />
        <label htmlFor={inputId} className="text-nowrap user-select-none">
          {props.label || "Available"}{" "}
          <span className="font-monospace">{bigToString(limit)}</span>
          {props.extraLabel}
        </label>
        <div
          className={`user-select-none extra-label-right ${
            isInvalid ? "extra-padding" : ""
          }`}
        >
          {props.extraLabelRight}
        </div>
      </div>
      <button
        className="btn btn-outline-secondary"
        disabled={props.disabled}
        type="button"
        onClick={() => setIsMax(true)}
      >
        MAX
      </button>
    </div>
  );
}
