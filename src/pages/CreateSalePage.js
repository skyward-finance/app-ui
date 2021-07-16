import React from "react";
import CreatSale from "../components/CreateSale";
import { IsMainnet } from "../data/near";

export default function CreateSalePage(props) {
  return (
    <div>
      <div className="container">
        <div className="row mb-3">
          {IsMainnet ? (
            <div className="card">
              <div className="card-body">Coming soon...</div>
            </div>
          ) : (
            <CreatSale {...props} />
          )}
        </div>
      </div>
    </div>
  );
}
