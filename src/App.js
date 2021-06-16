import React, { useCallback, useEffect, useState } from "react";
import "error-polyfill";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle";
import "./App.scss";
import Logo from "./images/logo_horizontal_brand.png";
import SalesPage from "./pages/SalesPage";
import { BrowserRouter as Router, Link, Route, Switch } from "react-router-dom";
import AccountPage from "./pages/AccountPage";
import { IsMainnet, NearConfig, useNear } from "./data/near";
import SalePage from "./pages/SalePage";
import TreasuryPage from "./pages/TreasuryPage";
import CreateSalePage from "./pages/CreateSalePage";
import LinkMainnetPage from "./pages/LinkMainnetPage";

function App(props) {
  const [connected, setConnected] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signedAccountId, setSignedAccountId] = useState(null);

  const _near = useNear();

  const requestSignIn = useCallback(
    async (e) => {
      e && e.preventDefault();
      const appTitle = "Skyward Finance";
      const near = await _near;

      await near.walletConnection.requestSignIn(
        NearConfig.contractName,
        appTitle
      );
      return false;
    },
    [_near]
  );

  const logOut = useCallback(async () => {
    const near = await _near;
    near.walletConnection.signOut();
    near.accountId = null;
    setSignedIn(false);
    setSignedAccountId(null);
  }, [_near]);

  const refreshAllowance = useCallback(async () => {
    alert(
      "You're out of access key allowance. Need sign in again to refresh it"
    );
    await logOut();
    await requestSignIn();
  }, [logOut, requestSignIn]);

  useEffect(() => {
    _near.then((near) => {
      setSignedIn(!!near.accountId);
      setSignedAccountId(near.accountId);
      setConnected(true);
    });
  }, [_near]);

  const passProps = {
    refreshAllowance: () => refreshAllowance(),
    signedAccountId,
    signedIn,
    connected,
  };

  const header = !connected ? (
    <div>
      Connecting...{" "}
      <span
        className="spinner-grow spinner-grow-sm"
        role="status"
        aria-hidden="true"
      />
    </div>
  ) : signedIn ? (
    <div>
      <button className="btn btn-outline-light" onClick={() => logOut()}>
        Sign out ({signedAccountId})
      </button>
    </div>
  ) : (
    <div>
      <button
        className="btn btn-outline-light"
        onClick={(e) => requestSignIn(e)}
      >
        Sign in with NEAR Wallet
      </button>
    </div>
  );

  return (
    <div className="App">
      <Router basename={process.env.PUBLIC_URL}>
        <nav className="navbar navbar-expand-lg navbar-dark navbar-bg mb-3">
          <div className="container-fluid">
            <a
              className="navbar-brand"
              href="https://skyward.finance"
              title="Skyward Finance"
            >
              <img
                src={Logo}
                alt="Skyward Finance"
                className="d-inline-block align-middle"
              />
            </a>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarSupportedContent"
              aria-controls="navbarSupportedContent"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon" />
            </button>
            <div
              className="collapse navbar-collapse"
              id="navbarSupportedContent"
            >
              <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                <li className="nav-item">
                  <Link className="nav-link" aria-current="page" to="/">
                    Sales
                  </Link>
                </li>
                {signedIn && (
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      aria-current="page"
                      to={`/account/`}
                    >
                      Account
                    </Link>
                  </li>
                )}
                <li className="nav-item">
                  <Link
                    className="nav-link"
                    aria-current="page"
                    to="/treasury/"
                  >
                    Treasury
                  </Link>
                </li>
                {signedIn && (
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      aria-current="page"
                      to={`/create_sale/`}
                    >
                      Create Sale
                    </Link>
                  </li>
                )}
                {signedIn && !IsMainnet && (
                  <li className="nav-item">
                    <Link
                      className="nav-link"
                      aria-current="page"
                      to={`/link_mainnet/`}
                    >
                      Claim Mainnet $SKYWARD
                    </Link>
                  </li>
                )}
              </ul>
              <form className="d-flex">{header}</form>
            </div>
          </div>
        </nav>
        {!IsMainnet && (
          <div className="alert alert-warning text-center">
            This is a testnet version of the Skyward Finance app. The mainnet
            app and the mainnet $SKYWARD token are not live. There is no ERC-20
            token.
          </div>
        )}

        <Switch>
          <Route exact path={"/"}>
            <SalesPage {...passProps} />
          </Route>
          {signedIn && (
            <Route exact path={"/account/"}>
              <AccountPage {...passProps} />
            </Route>
          )}
          <Route exact path={"/treasury"}>
            <TreasuryPage {...passProps} />
          </Route>
          <Route exact path={"/sale/:saleId"}>
            <SalePage {...passProps} />
          </Route>
          {signedIn && (
            <Route exact path={"/create_sale/"}>
              <CreateSalePage {...passProps} />
            </Route>
          )}
          {signedIn && !IsMainnet && (
            <Route exact path={"/link_mainnet/"}>
              <LinkMainnetPage {...passProps} />
            </Route>
          )}
        </Switch>
      </Router>
    </div>
  );
}

export default App;
