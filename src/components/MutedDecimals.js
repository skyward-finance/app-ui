import React from "react";

export default function MutedDecimals(props) {
  const value = props.value;

  const dotPos = value.indexOf(".");
  if (dotPos > 0) {
    return (
      <>
        {value.charAt(0) === "<" ? (
          <>
            <span className="text-secondary">{"<"}</span>
            {value.substring(1, dotPos)}
          </>
        ) : (
          value.substring(0, dotPos)
        )}
        <span className="text-secondary">{value.substring(dotPos)}</span>
      </>
    );
  }
  return value;
}
