import React, { useCallback, useEffect, useState } from "react";
import { useAccount } from "../data/account";
import { singletonHook } from "react-singleton-hook";
import * as nearAPI from "near-api-js";
import { MainNearConfig, NearConfig, TGas } from "../data/near";
import AccountBalance from "../components/AccountBalance";
import Big from "big.js";
import TokenAndBalance from "../components/TokenAndBalance";
import { useToken } from "../data/token";
import { Loading } from "../data/utils";
import TokenBalance from "../components/TokenBalance";
import { Link } from "react-router-dom";

export default function LinkMainnetPage(props) {
  const account = useAccount();
  const mainnetNear = useMainnetNear();

  const [loading, setLoading] = useState(false);
  const [mainnetConnected, setMainnetConnected] = useState(false);
  const [mainnetSignedIn, setMainnetSignedIn] = useState(false);
  const [mainnetSignedAccountId, setMainnetSignedAccountId] = useState(null);

  const requestMainnetSignIn = async (e) => {
    e && e.preventDefault();
    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(MainNearConfig.walletUrl + "/login/");
    newUrl.searchParams.set("success_url", currentUrl.href);
    newUrl.searchParams.set("failure_url", currentUrl.href);
    window.location.assign(newUrl.toString());

    return false;
  };

  const mainnetLogOut = useCallback(async () => {
    const near = await mainnetNear;
    near.walletConnection.signOut();
    near.accountId = null;
    setMainnetSignedIn(false);
    setMainnetSignedAccountId(null);
  }, [mainnetNear]);

  useEffect(() => {
    if (account && account.accountId) {
      mainnetNear.then((near) => {
        if (near.accountId === account.accountId) {
          localStorage.removeItem(near.walletConnection._authDataKey);
          setMainnetSignedIn(false);
          setMainnetSignedAccountId(null);
          setMainnetConnected(true);
        } else {
          setMainnetSignedIn(!!near.accountId);
          setMainnetSignedAccountId(near.accountId);
          setMainnetConnected(true);
        }
      });
    }
  }, [mainnetNear, account]);

  const mainnetSignInButton = !mainnetConnected ? (
    <div>
      Connecting...{" "}
      <span
        className="spinner-grow spinner-grow-sm"
        role="status"
        aria-hidden="true"
      />
    </div>
  ) : mainnetSignedIn ? (
    <div>
      <button
        className="btn btn-outline-primary"
        onClick={() => mainnetLogOut()}
      >
        Sign out of NEAR mainnet account ({mainnetSignedAccountId})
      </button>
    </div>
  ) : (
    <div>
      <div className="mt-3 mb-3">
        To claim $SKYWARD token on mainnet, you need to link your mainnet
        account. Please link with your real mainnet NEAR wallet.
      </div>
      <div>
        <button
          className="btn btn-primary"
          onClick={(e) => requestMainnetSignIn(e)}
        >
          Link mainnet NEAR Wallet
        </button>
      </div>
    </div>
  );

  const balance = account &&
    !account.loading &&
    NearConfig.skywardTokenAccountId in account.balances && (
      <AccountBalance tokenAccountId={NearConfig.skywardTokenAccountId} />
    );

  const [mainnetBalance, setMainnetBalance] = useState(false);
  useEffect(() => {
    if (
      mainnetBalance === false &&
      account &&
      account.near &&
      mainnetSignedAccountId
    ) {
      const fetchLockedBalance = async () => {
        return Big(
          await account.near.account.viewFunction(
            NearConfig.tokenSwapAccountId,
            "get_balance",
            {
              account_id: mainnetSignedAccountId,
            }
          )
        );
      };
      fetchLockedBalance().then(setMainnetBalance);
    }
  }, [account, mainnetBalance, mainnetSignedAccountId]);

  const skywardToken = useToken(NearConfig.skywardTokenAccountId);

  const lockSkyward = async (e) => {
    e.preventDefault();
    setLoading(true);

    const amount = await skywardToken.contract.balanceOf(
      account,
      account.accountId
    );

    const actions = [
      [
        NearConfig.skywardTokenAccountId,
        nearAPI.transactions.functionCall(
          "ft_transfer_call",
          {
            receiver_id: NearConfig.tokenSwapAccountId,
            amount: amount.toFixed(0),
            memo: `Locking to get real $SKYWARD`,
            msg: JSON.stringify({
              LinkMainnetAccount: {
                account_id: mainnetSignedAccountId,
              },
            }),
          },
          TGas.mul(50).toFixed(0),
          1
        ),
      ],
    ];

    await account.near.sendTransactions(actions);
  };

  const [skywardBalance, setSkywardBalance] = useState(false);
  useEffect(() => {
    if (account && account.accountId && skywardToken) {
      skywardToken.contract
        .balanceOf(account, account.accountId)
        .then(setSkywardBalance);
    }
  }, [account, skywardToken]);

  return (
    <div>
      <div className="container">
        <div className="row mb-3">
          <div className="card mb-2">
            <div className="card-body">
              <h2 className="primary-header">Claim Mainnet $SKYWARD</h2>
              <div>{mainnetSignInButton}</div>
              {mainnetBalance && mainnetBalance.gt(0) && (
                <div className="mt-2">
                  Locked $TEST_SKYWARD
                  <div className="mt-2">
                    <TokenAndBalance
                      tokenAccountId={NearConfig.skywardTokenAccountId}
                      balances={[
                        ["LOCKED: ", mainnetBalance],
                        [
                          "EXPECTED REAL $SKYWARD: ",
                          mainnetBalance.div(50).round(),
                        ],
                      ]}
                    />
                  </div>
                </div>
              )}
              {mainnetSignedIn && (
                <div className="mt-2">
                  <hr />
                  Current $TEST_SKYWARD balance{" "}
                  <span className="text-muted">
                    (if you don't see the balance,{" "}
                    <Link to="/sale/0">go to the sale and click Claim</Link>)
                  </span>
                  <div className="mt-2 mb-2">{balance}</div>
                  {skywardBalance && skywardBalance.gt(0) && (
                    <div>
                      <button
                        className="btn btn-primary"
                        disabled={
                          loading || !skywardBalance || skywardBalance.eq(0)
                        }
                        onClick={(e) => lockSkyward(e)}
                      >
                        {loading && Loading}
                        Lock{" "}
                        <TokenBalance
                          tokenAccountId={NearConfig.skywardTokenAccountId}
                          balance={skywardBalance}
                        />{" "}
                        $TEST_SKYWARD to get real $SKYWARD
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function _initMainnetNear() {
  const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore(
    localStorage,
    "mainnet"
  );
  const nearConnection = await nearAPI.connect(
    Object.assign({ deps: { keyStore } }, MainNearConfig)
  );
  const _near = {};

  _near.keyStore = keyStore;
  _near.nearConnection = nearConnection;

  _near.walletConnection = new nearAPI.WalletConnection(
    nearConnection,
    "skyward-mainnet-link"
  );
  _near.accountId = _near.walletConnection.getAccountId();
  _near.account = _near.walletConnection.account();

  return _near;
}

const defaultMainnetNear = Promise.resolve(_initMainnetNear());
const useMainnetNear = singletonHook(defaultMainnetNear, () => {
  return defaultMainnetNear;
});
