// SPDX-License-Identifier: MIT

/**
 * Example coin is deployed on both devnet and testnet networks
 * The coin owner has been funded on both devnet and testnet networks
 * Private key is exposed because it is used only for testing, with no real tokens
 */

import fs from "fs";
import {
  AptosAccount,
  TxnBuilderTypes,
  MaybeHexString,
  HexString,
  Network,
  Types,
  Provider,
  FungibleAssetClient,
  CustomEndpoints,
  FaucetClient,
} from "aptos";

const NODE_URL =
  process.env.APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com";
const FAUCET_URL =
  process.env.APTOS_FAUCET_URL || "https://faucet.testnet.aptoslabs.com";
const OWNER_ADDR =
  process.env.OWNER_ADDR ||
  "d13c155015121b598283cf4290955a68bb659228b2aacacbcee2a851e48b4e49";

const FROZEN_ERROR = "ESTORE_IS_FROZEN";

class MyCoinClient extends Provider {
  constructor(network: Network | CustomEndpoints) {
    super(network);
  }

  async getMetadata(admin: AptosAccount): Promise<MaybeHexString> {
    const payload: Types.ViewRequest = {
      function: `${admin.address().hex()}::coin_example::get_metadata`,
      type_arguments: [],
      arguments: [],
    };
    return ((await this.view(payload)) as any)[0].inner as MaybeHexString;
  }

  async mintCoin(admin: AptosAccount, receiverAddress: HexString, amount: number | bigint): Promise<string> {
    const rawTxn = await this.generateTransaction(admin.address(), {
      function: `${admin.address().hex()}::coin_example::mint`,
      type_arguments: [],
      arguments: [receiverAddress.hex(), amount],
    });

    const bcsTxn = await this.signTransaction(admin, rawTxn);
    const pendingTxn = await this.submitTransaction(bcsTxn);

    return pendingTxn.hash;
  }

  async transferCoin(
    admin: AptosAccount,
    fromAddress: HexString,
    toAddress: HexString,
    amount: number | bigint,
  ): Promise<string> {
    const rawTxn = await this.generateTransaction(admin.address(), {
      function: `${admin.address().hex()}::coin_example::transfer`,
      type_arguments: [],
      arguments: [fromAddress.hex(), toAddress.hex(), amount],
    });

    const bcsTxn = await this.signTransaction(admin, rawTxn);
    const pendingTxn = await this.submitTransaction(bcsTxn);

    return pendingTxn.hash;
  }

  async burnCoin(admin: AptosAccount, fromAddress: HexString, amount: number | bigint): Promise<string> {
    const rawTxn = await this.generateTransaction(admin.address(), {
      function: `${admin.address().hex()}::coin_example::burn`,
      type_arguments: [],
      arguments: [fromAddress.hex(), amount],
    });

    const bcsTxn = await this.signTransaction(admin, rawTxn);
    const pendingTxn = await this.submitTransaction(bcsTxn);

    return pendingTxn.hash;
  }

  async freeze(admin: AptosAccount, targetAddress: HexString): Promise<string> {
    const rawTxn = await this.generateTransaction(admin.address(), {
      function: `${admin.address().hex()}::coin_example::freeze_account`,
      type_arguments: [],
      arguments: [targetAddress.hex()],
    });

    const bcsTxn = await this.signTransaction(admin, rawTxn);
    const pendingTxn = await this.submitTransaction(bcsTxn);

    return pendingTxn.hash;
  }

  async unfreeze(admin: AptosAccount, targetAddress: HexString): Promise<string> {
    const rawTxn = await this.generateTransaction(admin.address(), {
      function: `${admin.address().hex()}::coin_example::unfreeze_account`,
      type_arguments: [],
      arguments: [targetAddress.hex()],
    });

    const bcsTxn = await this.signTransaction(admin, rawTxn);
    const pendingTxn = await this.submitTransaction(bcsTxn);

    return pendingTxn.hash;
  }
}

async function main() {
  // Clients setup
  const client = new MyCoinClient({ fullnodeUrl: NODE_URL });
  const fungibleAssetClient = new FungibleAssetClient(client);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

  // Accounts setup and funding
  const privateKeyHex = fs.readFileSync("./d13.key", "utf8").trim();
  const privateKeyUint8Array = new Uint8Array(
    privateKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const coinOwner = new AptosAccount(privateKeyUint8Array, OWNER_ADDR);
  const bob = new AptosAccount();
  const charlie = new AptosAccount();

  await faucetClient.fundAccount(bob.address(), 100_000_000);
  await faucetClient.fundAccount(charlie.address(), 100_000_000);

  // Get initial balance
  const metadata_addr = await client.getMetadata(coinOwner);
  console.log(
    `Owner's initial coin balance: ${await fungibleAssetClient.getPrimaryBalance(
      coinOwner.address(),
      metadata_addr
    )}.`
  );
  console.log(
    `Bob's initial coin balance: ${await fungibleAssetClient.getPrimaryBalance(
      bob.address(),
      metadata_addr
    )}.`
  );
  console.log(
    `Charlie's initial coin balance: ${await fungibleAssetClient.getPrimaryBalance(
      charlie.address(),
      metadata_addr
    )}.\n`
  );

  // Owner mints coins to Bob and himself
  let txnHash = await client.mintCoin(coinOwner, bob.address(), 100);
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  txnHash = await client.mintCoin(coinOwner, coinOwner.address(), 100);
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  console.log(
    `Bob's updated coin primary fungible store balance after minting: ${await fungibleAssetClient.getPrimaryBalance(
      bob.address(),
      metadata_addr,
    )}.`,
  );
  console.log(
    `Owner's updated coin primary fungible store balance after minting: ${await fungibleAssetClient.getPrimaryBalance(
      coinOwner.address(),
      metadata_addr,
    )}.\n`,
  );

  // Owner transfer coins from Bob to Charlie
  txnHash = await client.transferCoin(coinOwner, bob.address(), charlie.address(), 100);
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  console.log(
    `Bob's updated coin balance after transfer from Bob to Charlie by Owner: ${await fungibleAssetClient.getPrimaryBalance(bob.address(), metadata_addr)}.`,
  );
  console.log(
    `Charlie's updated coin balance after transfer from Bob to Charlie by Owner: ${await fungibleAssetClient.getPrimaryBalance(charlie.address(), metadata_addr)}.\n`,
  );

  // Owner burnt some Charlies coins
  txnHash = await client.burnCoin(coinOwner, charlie.address(), 50);
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  console.log(
    `Charlie's updated coin balance after Owner burnt Charlie coins: ${await fungibleAssetClient.getPrimaryBalance(charlie.address(), metadata_addr)}.`,
  );
  console.log(
    `Owner's updated coin balance after Owner burnt Charlie coins: ${await fungibleAssetClient.getPrimaryBalance(coinOwner.address(), metadata_addr)}.\n`,
  );

  // Owner freezes Charlie's account and Charlie fails to send coins
  txnHash = await client.freeze(coinOwner, charlie.address());
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  console.log("Owner has frozen Charlie's account\n");

  try{
    txnHash = await fungibleAssetClient.transfer(charlie, metadata_addr, bob.address(), 40);
    await client.waitForTransaction(txnHash, { checkSuccess: true });
  } catch(e) {
    const error = (e as {message: string});
    if(error.message.includes(FROZEN_ERROR)){
      console.log("Charlie can't transfer coins because his account is frozen\n");
    } else {
      throw new Error(error.message);
    }
  }

  // Owner unfreezes Charlie's account and Charlie managed to send coins
  txnHash = await client.unfreeze(coinOwner, charlie.address());
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  console.log("Owner has unfrozen Charlie's account\n");

  txnHash = await fungibleAssetClient.transfer(charlie, metadata_addr, bob.address(), 40);
  await client.waitForTransaction(txnHash, { checkSuccess: true });
  console.log(
    `Charlie's updated coin balance after sending coins by Charlie to Bob: ${await fungibleAssetClient.getPrimaryBalance(charlie.address(), metadata_addr)}.`,
  );
  console.log(
    `Bob's updated coin balance after sending coins by Charlie to Bob: ${await fungibleAssetClient.getPrimaryBalance(bob.address(), metadata_addr)}.`,
  );
}

main();
