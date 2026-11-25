/**
 * Base de demonstração: insumos e composições com preços ilustrativos, para testar o sistema
 * antes da primeira carga do SINAPI. Não é a tabela oficial. Fonte "Demonstração", RJ, outubro de 2026.
 */
import type { CargaSinapi } from "../servicos/importador-sinapi";
import type { TipoInsumo } from "../servicos/precos";

type I = [codigo: string, descricao: string, unidade: string, tipo: TipoInsumo, naoDesonerado: string, desonerado?: string];
const INSUMOS: I[] = [
  ["D-0101", "AREIA MÉDIA LAVADA", "M3", "material", "125.00"],
  ["D-0102", "PEDRA BRITADA Nº 1", "M3", "material", "118.00"],
  ["D-0103", "CIMENTO PORTLAND COMPOSTO CP II-32", "KG", "material", "0.92"],
  ["D-0104", "CAL HIDRATADA CH-III PARA ARGAMASSAS", "KG", "material", "1.05"],
  ["D-0105", "BLOCO CERÂMICO DE VEDAÇÃO 9 X 19 X 19 CM", "UN", "material", "1.37"],
  ["D-0106", "AÇO CA-50, 10,0 MM, VERGALHÃO", "KG", "material", "8.90"],
  ["D-0107", "AÇO CA-50, 8,0 MM, VERGALHÃO", "KG", "material", "9.10"],
  ["D-0108", "AÇO CA-60, 5,0 MM, VERGALHÃO", "KG", "material", "9.60"],
  ["D-0109", "ARAME RECOZIDO 18 BWG", "KG", "material", "18.50"],
  ["D-0110", "TÁBUA DE PINUS 2,5 X 30 CM", "M", "material", "14.20"],
  ["D-0111", "PREGO DE AÇO 18 X 27 COM CABEÇA", "KG", "material", "19.90"],
  ["D-0112", "TINTA LÁTEX ACRÍLICA PREMIUM", "L", "material", "21.50"],
  ["D-0113", "SELADOR ACRÍLICO PARA PAREDES", "L", "material", "12.80"],
  ["D-0114", "ÁGUA POTÁVEL", "M3", "material", "9.80"],
  ["D-0115", "SARRAFO DE PINUS 2,5 X 10 CM", "M", "material", "4.20"],
  ["D-0116", "LIXA PARA PAREDE Nº 100", "UN", "material", "0.95"],
  ["D-0201", "PEDREIRO", "H", "mao_de_obra", "27.13", "22.40"],
  ["D-0202", "SERVENTE DE OBRAS", "H", "mao_de_obra", "19.41", "16.02"],
  ["D-0203", "CARPINTEIRO DE FORMAS", "H", "mao_de_obra", "27.13", "22.40"],
  ["D-0204", "ARMADOR", "H", "mao_de_obra", "27.13", "22.40"],
  ["D-0205", "PINTOR", "H", "mao_de_obra", "27.13", "22.40"],
  ["D-0206", "TOPÓGRAFO", "H", "mao_de_obra", "38.50", "31.80"],
  ["D-0301", "BETONEIRA 400 L, CUSTO HORÁRIO PRODUTIVO", "H", "equipamento", "3.90"],
];

type K = [codigo: string, descricao: string, unidade: string, grupo: string, itens: [string, string][]];
const COMPOSICOES: K[] = [
  ["D-1001", "ARGAMASSA DE CIMENTO, CAL E AREIA TRAÇO 1:2:8, PREPARO EM BETONEIRA", "M3", "Argamassas e concretos",
    [["D-0103", "182"], ["D-0104", "145"], ["D-0101", "1.16"], ["D-0114", "0.25"], ["D-0202", "10"], ["D-0301", "0.6"]]],
  ["D-1002", "CONCRETO FCK 20 MPA, PREPARO EM BETONEIRA", "M3", "Argamassas e concretos",
    [["D-0103", "330"], ["D-0101", "0.70"], ["D-0102", "0.82"], ["D-0114", "0.19"], ["D-0202", "6"], ["D-0301", "0.9"]]],
  ["D-1003", "ARGAMASSA DE CIMENTO E AREIA TRAÇO 1:3, PREPARO EM BETONEIRA", "M3", "Argamassas e concretos",
    [["D-0103", "486"], ["D-0101", "1.05"], ["D-0114", "0.30"], ["D-0202", "10"], ["D-0301", "0.6"]]],
  ["D-1101", "LOCAÇÃO DE OBRA COM GABARITO DE TÁBUAS CORRIDAS", "M", "Serviços preliminares",
    [["D-0110", "0.35"], ["D-0115", "0.40"], ["D-0111", "0.02"], ["D-0203", "0.18"], ["D-0202", "0.09"], ["D-0206", "0.02"]]],
  ["D-1102", "ESCAVAÇÃO MANUAL DE VALA ATÉ 1,5 M DE PROFUNDIDADE", "M3", "Movimento de terra",
    [["D-0202", "4.5"]]],
  ["D-1103", "SAPATA CORRIDA EM CONCRETO ARMADO, COM FÔRMA E ARMAÇÃO", "M3", "Fundações",
    [["D-1002", "1.05"], ["D-0106", "40"], ["D-0109", "0.8"], ["D-0110", "6"], ["D-0111", "0.6"], ["D-0201", "4"], ["D-0202", "8"], ["D-0204", "3"], ["D-0203", "3"]]],
  ["D-1104", "ALVENARIA DE VEDAÇÃO COM BLOCO CERÂMICO 9 X 19 X 19 CM, ARGAMASSA 1:2:8", "M2", "Alvenaria",
    [["D-0105", "25"], ["D-1001", "0.0105"], ["D-0201", "0.8"], ["D-0202", "0.4"]]],
  ["D-1105", "PILARETE EM CONCRETO ARMADO 15 X 15 CM, COM FÔRMA E ARMAÇÃO", "M", "Estrutura",
    [["D-1002", "0.0236"], ["D-0107", "1.6"], ["D-0108", "0.6"], ["D-0109", "0.03"], ["D-0110", "0.6"], ["D-0111", "0.05"], ["D-0201", "0.4"], ["D-0202", "0.6"], ["D-0204", "0.2"], ["D-0203", "0.3"]]],
  ["D-1106", "CINTA DE AMARRAÇÃO EM CONCRETO ARMADO 15 X 10 CM, COM FÔRMA E ARMAÇÃO", "M", "Estrutura",
    [["D-1002", "0.0158"], ["D-0107", "1.2"], ["D-0108", "0.4"], ["D-0109", "0.02"], ["D-0110", "0.4"], ["D-0111", "0.03"], ["D-0201", "0.3"], ["D-0202", "0.45"], ["D-0204", "0.15"], ["D-0203", "0.25"]]],
  ["D-1107", "CHAPISCO EM PAREDE COM ARGAMASSA 1:3", "M2", "Revestimento",
    [["D-1003", "0.0042"], ["D-0201", "0.07"], ["D-0202", "0.07"]]],
  ["D-1108", "REBOCO DE PAREDE, ESPESSURA 2 CM, ARGAMASSA 1:2:8", "M2", "Revestimento",
    [["D-1001", "0.024"], ["D-0201", "0.45"], ["D-0202", "0.45"]]],
  ["D-1109", "PINTURA LÁTEX ACRÍLICA EM PAREDE, DUAS DEMÃOS, COM SELADOR", "M2", "Pintura",
    [["D-0113", "0.12"], ["D-0112", "0.17"], ["D-0116", "0.1"], ["D-0205", "0.3"], ["D-0202", "0.1"]]],
];

export function cargaDemonstracao(): CargaSinapi {
  const carga: CargaSinapi = {
    uf: "RJ", mes: "2026-10-01", arquivos: ["Base de demonstração"],
    insumos: new Map(), composicoes: new Map(),
    precos: { desonerado: new Map(), nao_desonerado: new Map() },
    custos: { desonerado: new Map(), nao_desonerado: new Map() },
    analitico: [], avisos: [],
  };
  for (const [codigo, descricao, unidade, tipo, nd, d] of INSUMOS) {
    carga.insumos.set(codigo, { descricao, unidade, tipo, grupo: null });
    carga.precos.nao_desonerado.set(codigo, { preco: nd, origem: "Ilustrativo" });
    carga.precos.desonerado.set(codigo, { preco: d ?? nd, origem: "Ilustrativo" });
  }
  const ehComposicao = new Set(COMPOSICOES.map((k) => k[0]));
  for (const [codigo, descricao, unidade, grupo, itens] of COMPOSICOES) {
    carga.composicoes.set(codigo, { descricao, unidade, grupo });
    for (const [item, coeficiente] of itens) carga.analitico.push({ composicao: codigo, tipo: ehComposicao.has(item) ? "composicao" : "insumo", item, coeficiente });
  }
  return carga;
}
