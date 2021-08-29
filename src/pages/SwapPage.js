import React from "react";
import Swap from "../components/swap/Swap";
import { useParams } from "react-router-dom";

export default function SwapPage(props) {
  const { inputTokenId, outputTokenId } = useParams();

  return (
    <div>
      <div className="container">
        <div className="row justify-content-md-evenly">
          <Swap
            inputTokenId={inputTokenId}
            outputTokenId={outputTokenId}
            {...props}
          />
        </div>
      </div>
    </div>
  );
}
