import "./Home.scss";
import React, { useState } from "react";
import uuid from "react-uuid";

function HomePage(props) {
  const [gkey] = useState(uuid());

  const cards = "";

  return (
    <div>
      <div className="container">
        <div className="row justify-content-md-center mb-3">
          {cards.length > 0 && (
            <div>
              <h3>Recent votes</h3>
              {cards}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
