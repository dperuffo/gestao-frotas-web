import crypto from "node:crypto";
import { textoCanonicoTermoAdesao, textoCanonicoTermoAdesaoPosto } from "./src/lib/termoAdesao.ts";

function sha256(txt) {
  return crypto.createHash("sha256").update(txt, "utf8").digest("hex");
}

const enterprise = textoCanonicoTermoAdesao("enterprise");
const postoEnterprise = textoCanonicoTermoAdesaoPosto("posto_enterprise");

console.log("enterprise hash:", sha256(enterprise));
console.log("posto_enterprise hash:", sha256(postoEnterprise));
