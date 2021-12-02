import { useToken } from "../../data/token";

export default function TokenSymbol(props) {
  const tokenAccountId = props.tokenAccountId;
  const token = useToken(tokenAccountId);
  return !tokenAccountId
    ? "???"
    : !token
    ? tokenAccountId
    : token.invalidAccount
    ? `Invalid account Id ${tokenAccountId}`
    : token.notFound
    ? `Token Id ${tokenAccountId} not found`
    : token.metadata.symbol;
}
