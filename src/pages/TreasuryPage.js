import React from "react";
import Treasury from "../components/Treasury";

export default function TreasuryPage(props) {
  return (
    <div>
      <div className="container">
        <div className="row mb-3">
          <Treasury {...props} />
        </div>
      </div>
    </div>
  );
}
