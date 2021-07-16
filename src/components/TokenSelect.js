import React from "react";
import { useAccount } from "../data/account";
import AsyncSelect from "react-select/async";
import TokenBadge from "./TokenBadge";

const selectStyles = {
  singleValue: (provided, state) => ({
    ...provided,
    position: "relative",
    top: 0,
    transform: "none",
    webkitTransform: "none",
    overflow: "auto",
    margin: "0.5rem",
  }),
  option: (provided, state) => ({
    ...provided,
    color: "default",
    backgroundColor: state.isFocused ? "#684e8322" : "default",
  }),
};

export default function TokenSelect(props) {
  const account = useAccount();

  const propsFilter = props.tokenFilter || (() => true);
  const tokenFilter = (option) => propsFilter(option.value);

  const tokenOptions =
    account && !account.loading
      ? Object.entries(account.balances)
          .map(([tokenAccountId, _balance]) => ({
            value: tokenAccountId,
            label: <TokenBadge tokenAccountId={tokenAccountId} />,
          }))
          .filter(tokenFilter)
      : [];

  const loadOptions = async (inputValue) => {
    return [
      {
        value: inputValue,
        label: <TokenBadge tokenAccountId={inputValue} />,
      },
      ...tokenOptions.filter((option) => option.value !== inputValue),
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

  return (
    <AsyncSelect
      id={props.id}
      cacheOptions
      styles={selectStyles}
      defaultOptions={tokenOptions}
      loadOptions={loadOptions}
      onInputChange={handleInputChange}
      onChange={onSelectTokenId}
      placeholder={"Select an existing token or enter a new token account ID"}
    />
  );
}
