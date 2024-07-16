import * as web3 from "@solana/web3.js";
import data from "./data.json";
import getKeypairFromSecretKey from "./src/utils/getKeypairFromSecretKey";
import inquirer from "inquirer";
import actions from "./src/actions";
import displayPublicKey from "./src/actions/displayPublicKey";
import getSolAirdrop from "./src/actions/getSolAirdrop";
import displayBalances from "./src/actions/displayBalances";
import sendTokenSingle from "./src/actions/sendTokenSingle";
import sendTokenBulk from "./src/actions/sendTokenBulk";
import swapTokens from "./src/actions/swapTokens";
import generateNewPrivateKey from "./src/utils/generateNewPrivateKey";

/**
 * Main function that starts the application.
 */
async function main() {
  // Get the RPC and private key from the data.json file
  const { rpc, privateKey } = data;

  // Check if RPC is specified
  if (!rpc) {
    throw new Error("RPC is not specified");
  }

  // Create a connection with the RPC
  const connection = new web3.Connection(rpc);
  if (!connection) {
    throw new Error("Connection couldn't be established. Check if the RPC is correct");
  }

  // Check if private key is specified
  if (!privateKey) {
    generateNewPrivateKey();
  }

  // Create a keypair from the private key
  const keypair = getKeypairFromSecretKey(data.privateKey);

  // Get the available actions and map them to an array of choices
  const choices = actions.map((action) => ({
    name: `${action.id}. ${action.name}`,
    value: action,
  }));

  // Prompt the user to select an action
  const { selectedAction } = await inquirer.prompt({
    type: "list",
    name: "selectedAction",
    message: "Choose an Action:",
    choices,
  });

  // Get the selected action ID
  const selectedActionId = selectedAction.id;

  // Check if selected action ID is null
  if (selectedActionId === null) throw new Error("Invalid action");

  // Execute the selected action
  switch (selectedActionId) {
    case 1:
      displayPublicKey(keypair);
      break;
    case 2:
      await getSolAirdrop(keypair);
      break;
    case 3:
      await displayBalances(connection, keypair);
      break;
    case 4:
      await sendTokenSingle(connection, keypair);
      break;
    case 5:
      await sendTokenBulk(connection, keypair);
      break;
    case 6:
      await swapTokens(connection, keypair);
      break;
    default:
      throw new Error("Invalid option");
  }

  // Catch any errors that occur during the execution of the actions
  try {
  } catch (error) {
    console.error(error.message);
  }
}

// Call the main function to start the application
main();
