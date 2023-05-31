import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import { make_pubkey, make_wager } from "./vx";

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { DemoFairCoinToss } from "verifier/dist/wagers/demo_fair_coin_toss";
import { DemoFairCoinToss_Choice } from "verifier/dist/wagers/demo_fair_coin_toss";
import {
  getOutcomeFairCoinToss,
  getResultFairCoinToss,
} from "verifier/dist/getOutcome";
import { demoFairCoinToss_ChoiceToJSON } from "verifier/dist/wagers/demo_fair_coin_toss";

async function main() {
  console.log("Running vx demo...");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const GS_SEED_HASH = sha256(GS_SEED);

  const VX_PUBKEY = await make_pubkey(GS_SEED_HASH);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    GS_SEED_HASH := ${bytesToHex(GS_SEED_HASH)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}`
  );

  console.log(
    `Normally we'd show it to a player as single value (by either hashing them together, or concat'ing them) to make it easier to copy&paste, but you seem pretty technical`
  );

  console.log("--");

  // Allow the user to pick their own client seed by using console input
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const clientSeed = await rl.question("Enter Client Seed: ");

  console.log("Client seed is: ", clientSeed);

  let balance = 0;
  let nonce = 0;
  while (true) {
    console.log("---");
    const res = await rl.question(
      `[${nonce}] Guess Heads (H) or Tails (T) or Quit (Q): `
    );
    if (res.toLowerCase() === "q") {
      break;
    }
    let playerChoice: DemoFairCoinToss_Choice;
    if (res.toLowerCase() === "h") {
      playerChoice = DemoFairCoinToss_Choice.HEADS;
    } else if (res.toLowerCase() === "t") {
      playerChoice = DemoFairCoinToss_Choice.TAILS;
    } else {
      console.log("Invalid guess, try again");
      continue;
    }
    // Ok, so now we know what the player wants to guess, let's figure out the outcome!

    const GS_CONTRIBUTION = hmac(
      sha256,
      GS_SEED,
      utf8ToBytes(`${clientSeed}:${nonce}`) // This is inside hmac, so we're not worried about anything like length extension attacks
    );
    const wager: DemoFairCoinToss = {
      playerChoice,
    };

    const VX_SIGNATURE = await make_wager(GS_SEED_HASH, GS_CONTRIBUTION, wager);

    // Now as the game-server we need to make sure that Vx isn't cheating us or something
    // We can do this by verifying the signature.

    // This is actually pretty slow in js (but fine in native ), so you might want to verify in the background or in batches?
    const verified = bls.verify(VX_SIGNATURE, GS_CONTRIBUTION, VX_PUBKEY);

    const signatureHash = sha256(VX_SIGNATURE);

    const outcome = getResultFairCoinToss(signatureHash, wager);

    if (outcome == wager.playerChoice) {
      balance++;
    } else {
      balance--;
    }

    console.log(
      "Outcome: ",
      demoFairCoinToss_ChoiceToJSON(outcome),
      " (verified =",
      verified,
      ") Your new balance is =",
      balance
    );

    // console.log(
    //   `Players don't really need to see this, but doesn't hurt either:
    // VX_SIGNATURE :=`,
    //   bytesToHex(VX_SIGNATURE)
    // );

    nonce++;
  }
  console.log(
    "Thanks for playing! Your final balance is: ",
    balance,
    " and the information you'll need to verify your games is: ",
    {
      GS_SEED: bytesToHex(GS_SEED),
      GS_SEED_HASH: bytesToHex(GS_SEED_HASH),
      VX_PUBKEY: bytesToHex(VX_PUBKEY),
      GAMES_PLAYED: nonce,
    }
  );

  // request input from console input

  rl.close();
}

main();