import React from "react";
import "error-polyfill";
import "bootstrap/dist/js/bootstrap.bundle";
import "./App.scss";
import * as nearAPI from "near-api-js";
import Logo from "./images/logo_horizontal_white.png";
import HomePage from "./pages/Home";
import { BrowserRouter as Router, Link, Route, Switch } from "react-router-dom";
// import ls from "local-storage";

const IsMainnet = window.location.hostname === "berry.cards";
const TestNearConfig = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  archivalNodeUrl: "https://rpc.testnet.internal.near.org",
  contractName: "app1.skyward-dev.testnet",
  walletUrl: "https://wallet.testnet.near.org",
};
const MainNearConfig = {
  networkId: "mainnet",
  nodeUrl: "https://rpc.mainnet.near.org",
  archivalNodeUrl: "https://rpc.mainnet.internal.near.org",
  contractName: "cards.berryclub.ek.near",
  walletUrl: "https://wallet.near.org",
};

const NearConfig = IsMainnet ? MainNearConfig : TestNearConfig;

class App extends React.Component {
  constructor(props) {
    super(props);

    this._near = {};

    this._near.lsKey = NearConfig.contractName + ":v01:";

    this.state = {
      connected: false,
      isNavCollapsed: true,
      account: null,
      requests: null,
    };

    this._initNear().then(() => {
      this.setState({
        signedIn: !!this._near.accountId,
        signedAccountId: this._near.accountId,
        connected: true,
      });
    });
  }

  async _initNear() {
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect(
      Object.assign({ deps: { keyStore } }, NearConfig)
    );
    this._near.keyStore = keyStore;
    this._near.near = near;

    this._near.walletConnection = new nearAPI.WalletConnection(
      near,
      NearConfig.contractName
    );
    this._near.accountId = this._near.walletConnection.getAccountId();

    this._near.account = this._near.walletConnection.account();
    this._near.contract = new nearAPI.Contract(
      this._near.account,
      NearConfig.contractName,
      {
        viewMethods: [
          "balance_of",
          "balances_of",
          "get_num_balances",
          "get_subscribed_sales",
          "get_account_sales",
          "get_sale",
          "get_sales",
          "get_treasury_balance",
          "get_treasury_balances",
          "get_treasury_num_balances",
          "get_skyward_token_id",
          "get_skyward_total_supply",
          "get_listing_fee",
        ],
        changeMethods: [
          "register_token",
          "register_tokens",
          "withdraw_token",
          "donate_token_to_treasury",
          "sale_create",
          "sale_deposit_out_token",
          "sale_deposit_in_token",
          "sale_withdraw_in_token",
          "sale_distribute_unclaimed_tokens",
          "sale_claim_out_tokens",
          "redeem_skyward",
        ],
      }
    );

    if (this._near.accountId) {
    }
  }

  async requestSignIn(e) {
    e && e.preventDefault();
    const appTitle = "Skyward Finance";
    await this._near.walletConnection.requestSignIn(
      NearConfig.contractName,
      appTitle
    );
    return false;
  }

  async logOut() {
    this._near.walletConnection.signOut();
    this._near.accountId = null;
    this.setState({
      signedIn: false,
      signedAccountId: null,
    });
  }

  async refreshAllowance() {
    alert(
      "You're out of access key allowance. Need sign in again to refresh it"
    );
    await this.logOut();
    await this.requestSignIn();
  }

  render() {
    const passProps = {
      _near: this._near,
      updateState: (s, c) => this.setState(s, c),
      refreshAllowance: () => this.refreshAllowance(),
      ...this.state,
    };
    const header = !this.state.connected ? (
      <div>
        Connecting...{" "}
        <span
          className="spinner-grow spinner-grow-sm"
          role="status"
          aria-hidden="true"
        />
      </div>
    ) : this.state.signedIn ? (
      <div>
        <button className="btn btn-outline-light" onClick={() => this.logOut()}>
          Sign out ({this.state.signedAccountId})
        </button>
      </div>
    ) : (
      <div>
        <button
          className="btn btn-outline-light"
          onClick={(e) => this.requestSignIn(e)}
        >
          Sign in with NEAR Wallet
        </button>
      </div>
    );

    return (
      <div className="App">
        <Router basename={process.env.PUBLIC_URL}>
          <nav className="navbar navbar-expand-lg navbar-dark bg-primary mb-3">
            <div className="container-fluid">
              <Link className="navbar-brand" to="/" title="Skyward Finance">
                <img
                  src={Logo}
                  alt="Skyward Finance"
                  className="d-inline-block align-middle"
                />
              </Link>
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
                      Home
                    </Link>
                  </li>
                  {this.state.signedIn && (
                    <li className="nav-item">
                      <Link
                        className="nav-link"
                        aria-current="page"
                        to={`/a/${this.state.signedAccountId}`}
                      >
                        Profile
                      </Link>
                    </li>
                  )}
                  <li className="nav-item">
                    <Link className="nav-link" aria-current="page" to="/stats">
                      Stats
                    </Link>
                  </li>
                </ul>
                <form className="d-flex">{header}</form>
              </div>
            </div>
          </nav>

          <Switch>
            <Route exact path={"/"}>
              <HomePage {...passProps} />
            </Route>
          </Switch>
        </Router>
      </div>
    );
  }
}

export default App;
