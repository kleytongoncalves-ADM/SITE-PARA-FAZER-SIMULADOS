import { afterEach, describe, expect, it, vi } from "vitest";
import { esperaPedida, obterComEspera, recusaTemporaria } from "../scripts/rede";

afterEach(() => vi.unstubAllGlobals());

describe("download com espera", () => {
  it("reconhece recusas temporárias e a espera pedida pelo servidor", () => {
    expect([429, 403, 503].map(recusaTemporaria)).toEqual([true, true, true]);
    expect([200, 404].map(recusaTemporaria)).toEqual([false, false]);
    expect(esperaPedida("90")).toBe(90_000);
    expect(esperaPedida("99999")).toBe(600_000);
    expect(esperaPedida(null)).toBeNull();
  });

  it("tenta de novo depois de 429 e devolve o arquivo", async () => {
    const respostas = [new Response("", { status: 429 }), new Response("", { status: 429 }), new Response("PK", { status: 200 })];
    const f = vi.fn(async () => respostas.shift()!);
    vi.stubGlobal("fetch", f);
    const log: string[] = [];
    const r = await obterComEspera("https://exemplo/a.zip", {}, [1, 1, 1], (m) => log.push(m));
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(3);
    expect(log[0]).toContain("resposta 429");
  });

  it("desiste depois das tentativas e não repete 404", async () => {
    const f = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", f);
    expect((await obterComEspera("https://exemplo/a.zip", {}, [1, 1], () => {})).status).toBe(429);
    expect(f).toHaveBeenCalledTimes(3);
    const g = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", g);
    expect((await obterComEspera("https://exemplo/b.zip", {}, [1, 1], () => {})).status).toBe(404);
    expect(g).toHaveBeenCalledTimes(1);
  });
});
