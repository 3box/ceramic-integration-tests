/**
 * @jest-environment ./build/index.js
 */

import {CeramicApi} from "@ceramicnetwork/common";
import * as sha256 from "@stablelib/sha256";
import * as uint8arrays from "uint8arrays";
import KeyDidResolver from "key-did-resolver";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import { Resolver } from "did-resolver";
import {DID, GeneralJWS} from "dids";
import ThreeIdProvider from "3id-did-provider";
import {TileDocument} from "@ceramicnetwork/stream-tile";
import {waitForAnchor} from "../utils";
import * as didJWT from "did-jwt";

declare global {
    const ceramic: CeramicApi;
}

async function extractKid(did: DID): Promise<string> {
    const jws = await did.createJWS(`KID ${Math.random()}`);
    const headerRaw = jws.signatures[0].protected;
    const header = JSON.parse(
        uint8arrays.toString(uint8arrays.fromString(headerRaw, "base64url"))
    );
    return header.kid as string;
}

function toGeneralJWS(jws: string): GeneralJWS {
    const [protectedHeader, payload, signature] = jws.split('.')
    return {
        payload,
        signatures: [{ protected: protectedHeader, signature }],
    }
}

let originalDid: DID

beforeEach(() => {
    originalDid = ceramic.did
})

afterEach(() => {
    ceramic.did = originalDid
})

test('key revocation', async () => {
    jest.setTimeout(1000 * 60 * 30) // 30 minutes
    console.log("Starting test: key revocation")

    // 1. Setup initial keys
    const seedString = `first-seed-${Math.random()}`;
    const seed = sha256.hash(uint8arrays.fromString(seedString));
    const keyDidResolver = KeyDidResolver.getResolver();
    const threeIdResolver = ThreeIdResolver.getResolver(ceramic);
    const resolver = new Resolver({
        ...threeIdResolver,
        ...keyDidResolver,
    });
    const threeIdProvider = await ThreeIdProvider.create({
        getPermission: async () => [],
        authSecret: seed,
        authId: "first",
        ceramic: ceramic,
    });
    const did = new DID({
        provider: threeIdProvider.getDidProvider(),
        resolver: resolver,
    });
    await did.authenticate();
    ceramic.did = did;
    const firstKid = await extractKid(ceramic.did);
    const firstSigner = threeIdProvider.keychain._keyring.getSigner();

    // 2. Create tile
    const tile = await TileDocument.create(ceramic, {
        stage: "Signed by vanilla",
    });
    await tile.update({ stage: "Signed second time" }, undefined, {
        anchor: true,
    });
    await waitForAnchor(tile);

    // 3. Rotate key
    await threeIdProvider.keychain.add(
        "second",
        sha256.hash(uint8arrays.fromString(`second-seed-${Math.random()}`))
    );
    await threeIdProvider.keychain.remove("first");
    await threeIdProvider.keychain.commit();
    const didTile = await ceramic.loadStream(did.id.replace(`did:3:`, ''))
    await waitForAnchor(didTile)

    // 3. Prepare signing with the old key
    const vanillaCreateJWS = ceramic.did.createJWS.bind(ceramic.did)
    ceramic.did.createJWS = async (payload, options) => {
        const compactJWS = await didJWT.createJWS(payload, firstSigner, {
            kid: firstKid,
        });
        return toGeneralJWS(compactJWS);
    };

    // 4. This should blow
    await expect(tile.update({ stage: "Should blow" }, undefined, {
        anchor: true,
    })).rejects.toThrow(/signature authored with a revoked DID version/)

    // 5. Current key should work though
    ceramic.did.createJWS = vanillaCreateJWS
    const okContent = { stage: 'Should work' }
    await tile.update(okContent)
    expect(tile.content).toEqual(okContent)
})
