import "./TokenBadge.scss";
import React from "react";
import { useToken } from "../../data/token";

export default function TokenBadge(props) {
  const tokenAccountId = props.tokenAccountId;
  const token = useToken(tokenAccountId);
  const tokenOk = token && !token.invalidAccount && !token.notFound;
  const name = tokenOk ? token.metadata.name : "";
  const icon = tokenOk && token.metadata.icon;
  const symbol = tokenOk ? token.metadata.symbol : tokenAccountId;
  return (
    <div className="d-inline-block token-badge">
      <div className="token-name text-truncate" title={name}>
        {name}
      </div>
      <div title={tokenAccountId}>
        {icon && <img src={icon} alt="Token Icon" />}
        <span className="font-monospace align-middle text-truncate">
          {symbol}
        </span>
      </div>
    </div>
  );
}
