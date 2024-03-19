import { Client, DEVICE_MODEL, StorageMemory } from "mtkruto/mod.ts";
import { signal } from "@preact/signals";
import { Button } from "../components/Button.tsx";
import { Caption } from "../components/Caption.tsx";
import { Input } from "../components/Input.tsx";
import { Label } from "../components/Label.tsx";
import { Select } from "../components/Select.tsx";
import { Error, error } from "./Error.tsx";
import { getDcIps } from "mtkruto/transport/2_transport_provider.ts";
import {
  serializeGramJS,
  serializePyrogram,
  serializeTelethon,
} from "../lib/session_string.tsx";
import { UNREACHABLE } from "mtkruto/1_utilities.ts";
import { Spinner2 } from "../components/icons/Spinner.tsx";
import { storedString } from "../lib/stored_signals.tsx";

const sessionString = signal("");
const loading = signal(false);

const apiId = storedString("", "string-session-generator_apiId");
const apiHash = storedString("", "string-session-generator_apiHash");
const environment = signal<"Production" | "Test">("Production");
const accountType = signal<"Bot" | "User">("Bot");
const account = signal("");
const library = signal<
  | "Telethon"
  | "Pyrogram"
  | "GramJS"
  | "mtcute"
  | "MTKruto"
>("Telethon");

export function SessionStringGenerator() {
  if (loading.value) {
    return (
      <div class="gap-1.5 text-xs opacity-50 flex w-full items-center justify-center max-w-lg mx-auto">
        <Spinner2 size={10} /> <span>Generating session string</span>
      </div>
    );
  }
  if (sessionString.value) {
    return (
      <>
        <div class="gap-4 flex flex-col w-full max-w-lg mx-auto">
          <div>
            <button
              class="text-grammy"
              onClick={() => sessionString.value = ""}
            >
              ← Back
            </button>
          </div>
          <div class="bg-border rounded-xl p-3 text-sm font-mono break-all select-text">
            {sessionString.value}
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(sessionString.value).then(() => {
                error.value = "Copied to clipboard.";
              });
            }}
          >
            Copy
          </Button>
        </div>
        <Error />
      </>
    );
  }
  return (
    <>
      <div class="gap-4 flex flex-col w-full max-w-lg mx-auto">
        <Label>
          <Caption>
            Environment
          </Caption>
          <Select
            values={[
              "Production",
              "Test",
            ]}
            onChange={(v) => environment.value = v}
          />
        </Label>
        <Label>
          <Caption>
            App Credentials
          </Caption>
          <Input
            placeholder="API ID"
            name="token"
            required
            value={apiId.value}
            onChange={(e) => apiId.value = e.currentTarget.value}
          />
          <Input
            placeholder="API hash"
            name="token"
            required
            value={apiHash.value}
            onChange={(e) => apiHash.value = e.currentTarget.value}
          />
        </Label>
        <Label>
          <Caption>
            Library
          </Caption>
          <Select
            values={[
              "Telethon",
              "Pyrogram",
              "GramJS",
              "mtcute",
              "MTKruto",
            ]}
            onChange={(v) => library.value = v}
          />
        </Label>
        <Label>
          <Caption>
            Account Type
          </Caption>
          <Select
            values={[
              "Bot",
              "User",
            ]}
            onChange={(v) => accountType.value = v}
          />
        </Label>
        <Label>
          <Caption>Account Details</Caption>
          <Input
            placeholder={accountType.value == "Bot"
              ? "Bot token"
              : "Phone number in international format"}
            value={account.value}
            onChange={(e) => account.value = e.currentTarget.value}
          />
        </Label>
        <Label>
          <Button
            onClick={() => {
              loading.value = true;
              generateSessionString().finally(() => {
                loading.value = false;
              });
            }}
          >
            Next
          </Button>
          <Caption>
            The credentials you enter are used only in connections made directly
            to Telegram.
          </Caption>
        </Label>
      </div>
      <Error />
    </>
  );
}

async function generateSessionString() {
  if (accountType.value != "Bot") {
    error.value = "The chosen account type is currently not supported.";
    return;
  }

  const apiId_ = Number(apiId.value);
  const apiHash_ = apiHash.value;
  const account_ = account.value;
  if (isNaN(apiId_) || !apiId_ || !apiHash_) {
    error.value = "Invalid API credentials.";
    return;
  }
  if (!account_) {
    error.value = "Invalid account details.";
    return;
  }

  const client = new Client(new StorageMemory(), apiId_, apiHash_, {
    deviceModel: navigator.userAgent.trim().split(" ")[0] || "Unknown",
  });
  await client.start(account_);

  const dc = await client.storage.getDc();
  const authKey = await client.storage.getAuthKey();
  if (!dc || !authKey) {
    UNREACHABLE();
  }

  const ip = getDcIps(dc, "ipv4")[0]; // TODO
  const dcId = Number(dc.split("-")[0]);

  switch (library.value) {
    case "Telethon":
      sessionString.value = serializeTelethon(dcId, ip, 80, authKey);
      break;
    case "Pyrogram": {
      const me = await client.getMe();
      sessionString.value = serializePyrogram(
        dcId,
        apiId_,
        environment.value == "Test" ? true : false,
        authKey,
        me.id,
        me.isBot,
      );
      break;
    }
    case "GramJS":
      sessionString.value = serializeGramJS(dcId, ip, 80, authKey);
      break;
    case "MTKruto":
      sessionString.value = await client.exportAuthString();
      break;
    default:
      error.value = "The chosen library is currently not supported.";
  }
}
