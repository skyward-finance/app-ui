import useSWR from "swr";
import { useAccount } from "./account";

export const getSalePermissionFetcher = async (
  _key,
  saleId,
  permissionsContractId,
  account
) => {
  if (!permissionsContractId) {
    return true;
  }
  if (!account || account.loading) {
    return false;
  }
  try {
    const res = await account.near.viewCall(
      permissionsContractId,
      "is_approved",
      {
        account_id: account.accountId,
        sale_id: saleId,
      }
    );
    return !!res;
  } catch (e) {
    // failed
  }
  return false;
};

export const useSalePermission = (sale) => {
  const { data: depositPermission } = useSWR(
    ["sale_permission", sale.saleId, sale.permissionsContractId, useAccount()],
    getSalePermissionFetcher
  );
  return depositPermission;
};
