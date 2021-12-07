import React from "react";
import AsyncSelect from "react-select/async";
import TokenBadge from "./TokenBadge";
import "./TokenSelect.scss";
import { tokenMatches } from "../../data/token";

const selectStyles = {
  singleValue: (provided, state) => ({
    ...provided,
    position: "relative",
    top: 0,
    transform: "none",
    webkitTransform: "none",
    overflow: "auto",
    margin: "0.25rem",
  }),
  option: (provided, state) => ({
    ...provided,
    color: "default",
    backgroundColor: state.isFocused ? "#684e8322" : "default",
  }),
};

export default function TokenSelect(props) {
  const propsFilter = props.tokenFilter || (() => true);
  const tokenFilter = (option) => propsFilter(option.value);

  const tokens = props.tokens;

  const tokenOptions = tokens
    .map((tokenAccountId) => ({
      value: tokenAccountId,
      label: <TokenBadge tokenAccountId={tokenAccountId} />,
    }))
    .filter(tokenFilter);

  const loadOptions = async (inputValue) => {
    return [
      {
        value: inputValue,
        label: <TokenBadge tokenAccountId={inputValue} />,
      },
      ...tokenOptions.filter((option) => {
        if (option.value === inputValue) {
          return false;
        }
        return tokenMatches(option.value, inputValue);
      }),
    ].filter(tokenFilter);
  };

  const handleInputChange = (value) => {
    return value;
  };

  const onSelectTokenId = (option) => {
    if (props.onSelectTokenId) {
      props.onSelectTokenId(option.value);
    }
  };

  const value = props.value
    ? {
        value: props.value,
        label: <TokenBadge tokenAccountId={props.value} />,
      }
    : null;

  return (
    <AsyncSelect
      id={props.id}
      className={props.className}
      classNamePrefix="react-select"
      isDisabled={props.disabled}
      cacheOptions
      value={value}
      styles={selectStyles}
      defaultOptions={tokenOptions}
      loadOptions={loadOptions}
      onInputChange={handleInputChange}
      onChange={onSelectTokenId}
      placeholder={"Select an existing token or enter a new token account ID"}
    />
  );
}
