import React, { useState } from "react";
import { useToken } from "../data/token";

function AccountRegisterToken(props) {
  const [tokenAccountId, setTokenAccountId] = useState(null);

  const updateTokenAccountId = async (e) => {
    const accountId = e.target.value.replace(/[^a-z\-_\d.]/, "");
    setTokenAccountId(accountId);
  };

  const token = useToken(tokenAccountId);

  return (
    <div>
      {tokenAccountId !== null ? (
        <div>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              value={tokenAccountId}
              placeholder={"Account ID of the token"}
              onChange={(e) => updateTokenAccountId(e)}
            />
            <button
              className="btn btn-primary text-light"
              onClick={() => setTokenAccountId("")}
            >
              Register token
            </button>
          </div>
          {!token ? (
            <div>Loading...</div>
          ) : token.invalidAccount ? (
            <div>Invalid account Id</div>
          ) : token.notFound ? (
            <div>Token Id not found</div>
          ) : (
            <div>
              <pre>{JSON.stringify(token)}</pre>
            </div>
          )}
        </div>
      ) : (
        <button
          className="btn btn-primary text-light"
          onClick={() => setTokenAccountId("")}
        >
          Add a token
        </button>
      )}
    </div>
  );
}

export default AccountRegisterToken;
