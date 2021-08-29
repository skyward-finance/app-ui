import React from "react";
import CreatSale from "../components/createSale/CreateSale";

export default function CreateSalePage(props) {
  return (
    <div>
      <div className="container">
        <div className="row mb-3">
          <CreatSale {...props} />
        </div>
      </div>
    </div>
  );
}
