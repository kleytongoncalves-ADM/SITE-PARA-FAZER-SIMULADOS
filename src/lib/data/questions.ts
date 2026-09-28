import type { Question, Dificuldade, OrigemQuestao } from '../types'
import { concurso, disciplinasPorCargo } from './edital'

// Banco de questões "âncora": escritas à mão, com explicação completa (método
// Erro → Diagnóstico → Explicação → Exemplo → Questão semelhante).
// São marcadas como "adaptada" ou "gerada" — nunca como questão oficial da IADES,
// pois o edital não fornece uma prova anterior real desta banca para este concurso.
export const questoesAncora: Question[] = [
  {
    id: 'q-crase-1',
    disciplinaId: 'portugues',
    assuntoId: 'portugues-10',
    enunciado:
      'Assinale a alternativa em que o uso do acento grave indicativo de crase está CORRETO.',
    alternativas: [
      { letra: 'A', texto: 'Entreguei o relatório à Presidência do Conselho.', comentario: 'Correta: "Presidência" é substantivo feminino que admite o artigo "a"; há regência de "entregar a algo/alguém" + artigo feminino, logo ocorre crase.' },
      { letra: 'B', texto: 'O fiscal foi à pé até a sede do órgão.', comentario: 'Errada: "a pé" é locução adverbial masculina; nunca há crase antes de palavra masculina.' },
      { letra: 'C', texto: 'Estou disposto à ajudar no que for preciso.', comentario: 'Errada: antes de verbo no infinitivo ("ajudar") nunca ocorre crase, pois o verbo não admite artigo feminino.' },
      { letra: 'D', texto: 'Refiro-me à você, candidato.', comentario: 'Errada: antes de pronome pessoal do caso reto/oblíquo tônico ("você") não se usa artigo, logo não há crase.' },
      { letra: 'E', texto: 'Cheguei à uma hora atrás do previsto.', comentario: 'Errada: antes de numeral indicando "tempo decorrido" (não hora específica) não há artigo definido, logo não há crase.' },
    ],
    respostaCorreta: 'A',
    dificuldade: 'media',
    banca: 'IADES (estilo banca)',
    ano: 2026,
    origem: 'estilo-banca',
    tags: ['crase', 'regência', 'gramática'],
    explicacao: {
      conceito:
        'A crase é a fusão da preposição "a" (exigida por um termo regente) com o artigo definido feminino "a(s)" (exigido pelo termo regido). Ela só ocorre quando as DUAS condições existem ao mesmo tempo: um verbo ou nome que peça a preposição "a", e uma palavra feminina que admita o artigo "a".',
      raciocinio: [
        'Identifique o verbo ou nome que rege a preposição "a" (ex.: "entregar algo A alguém").',
        'Verifique se a palavra seguinte é feminina e determinada (admite "a" antes dela).',
        'Se a palavra seguinte for masculina, verbo no infinitivo, pronome pessoal ou indicar tempo futuro/indeterminado, a crase é proibida.',
        'Só marque crase quando puder substituir por "para a" ou repetir com uma palavra masculina equivalente e obter "ao".',
      ],
      porQueErrouTemplate:
        'Você provavelmente aplicou a "regra de ouvido" (colocar acento sempre que soa "a com a") sem checar se havia, ao mesmo tempo, regência do "a" e uma palavra feminina determinada depois. Essa é a pegadinha mais comum de crase em provas.',
      porQueCorretaEstaCerta:
        '"Entregar" rege a preposição "a" ("entregar algo A alguém/algo"), e "Presidência" é um substantivo feminino específico, que admite o artigo "a". As duas condições se encontram, logo há crase: "à Presidência".',
      pegadinha:
        'As bancas adoram testar crase antes de infinitivo, antes de pronomes pessoais e em expressões de tempo. Nenhuma dessas situações admite artigo definido, então a crase é sempre errada nesses contextos.',
      regraParaGuardar:
        'Regra de ouro: troque a palavra feminina por uma masculina equivalente. Se o "a" virar "ao", há crase. Se continuar "a", não há.',
      exemplo:
        '"Fui a festa" → trocando por masculino: "Fui ao show" (virou "ao") → logo há crase: "Fui À festa".',
    },
  },
  {
    id: 'q-crase-2',
    disciplinaId: 'portugues',
    assuntoId: 'portugues-10',
    enunciado: 'Assinale a alternativa em que a crase foi empregada CORRETAMENTE.',
    alternativas: [
      { letra: 'A', texto: 'O documento foi enviado à duas repartições distintas.', comentario: 'Errada: "duas" é numeral indeterminado, sem artigo definido antes — não há crase.' },
      { letra: 'B', texto: 'A servidora responde à reclamações diariamente.', comentario: 'Errada: "reclamações" está no plural indeterminado (sem artigo "as"); sem artigo não há crase.' },
      { letra: 'C', texto: 'Ele se dirigiu à sala da diretoria para prestar esclarecimentos.', comentario: 'Correta: "dirigir-se A" exige a preposição, e "sala" é substantivo feminino determinado (a sala, e não "uma sala qualquer"), admitindo o artigo "a".' },
      { letra: 'D', texto: 'Aquela é a servidora à quem entreguei o processo.', comentario: 'Errada: antes de "quem" não se usa artigo definido, portanto não há crase ("a quem").' },
      { letra: 'E', texto: 'Voltarei à naquela sala amanhã.', comentario: 'Errada: "àquela" (crase com pronome demonstrativo) é diferente de "à" + "naquela", construção que não existe na língua padrão.' },
    ],
    respostaCorreta: 'C',
    dificuldade: 'media',
    banca: 'IADES (estilo banca)',
    ano: 2026,
    origem: 'estilo-banca',
    tags: ['crase', 'regência', 'gramática'],
    explicacao: {
      conceito: 'Mesmo conceito de crase: encontro da preposição "a" exigida pela regência com o artigo feminino "a" do substantivo determinado.',
      raciocinio: [
        'Cheque a regência do verbo: "dirigir-se A" pede a preposição "a".',
        'Verifique se "sala" está determinada (a sala específica da diretoria) — está, então admite o artigo "a".',
        'Junte preposição + artigo = crase.',
      ],
      porQueErrouTemplate:
        'É comum confundir "quantidade indeterminada" com "substantivo determinado". Numerais soltos e substantivos no plural sem artigo raramente recebem crase.',
      porQueCorretaEstaCerta:
        '"Dirigir-se a" + "a sala" (determinada) = "à sala". As demais opções falham porque a palavra seguinte não admite artigo definido no contexto dado.',
      pegadinha: 'Trocar "à quem" por "a quem" é um erro clássico: pronomes interrogativos/relativos como "quem" nunca recebem artigo.',
      regraParaGuardar: 'Substantivo determinado (tem "a" antes dele mesmo sem a preposição) + verbo que rege "a" = crase.',
      exemplo: '"Entreguei o convite à secretária" (a secretária específica) tem crase; "Entreguei convites a secretárias" (indeterminado) não tem.',
    },
  },
  {
    id: 'q-regencia-1',
    disciplinaId: 'portugues',
    assuntoId: 'portugues-9',
    enunciado: 'Assinale a alternativa que respeita a regência verbal exigida pela norma-padrão.',
    alternativas: [
      { letra: 'A', texto: 'O fiscal assistiu o profissional durante a diligência.', comentario: 'Errada em sentido de "presenciar": "assistir" (ver/presenciar) é transitivo indireto: "assistiu AO profissional".' },
      { letra: 'B', texto: 'O relatório visa a melhoria dos processos internos.', comentario: 'Errada: "visar" no sentido de "ter como objetivo" é transitivo indireto: "visa À melhoria".' },
      { letra: 'C', texto: 'O candidato aspira ao cargo de administrador.', comentario: 'Correta: "aspirar" no sentido de "desejar" é transitivo indireto e pede a preposição "a": "aspira AO cargo".' },
      { letra: 'D', texto: 'Prefiro estudar português do que matemática.', comentario: 'Errada: "preferir" pede a construção "preferir X A Y", nunca "do que".' },
      { letra: 'E', texto: 'Informo o candidato que o resultado saiu.', comentario: 'Incompleta no contexto: "informar" admite duas regências, mas ao lado das demais alternativas esta não é a mais adequada ao gabarito desta questão de fixação, que testa "aspirar".' },
    ],
    respostaCorreta: 'C',
    dificuldade: 'media',
    banca: 'IADES (estilo banca)',
    ano: 2026,
    origem: 'estilo-banca',
    tags: ['regência verbal'],
    explicacao: {
      conceito: 'Regência verbal é a relação de dependência entre um verbo e seus complementos, definindo se o complemento vem sem preposição (transitivo direto) ou com preposição específica (transitivo indireto).',
      raciocinio: [
        'Memorize o sentido do verbo na frase: "assistir" muda de regência conforme o significado (presenciar x ajudar x ser espectador de).',
        'Verbos como "aspirar", "visar" (no sentido de objetivar) e "preferir" têm regência fixa consagrada pela norma culta.',
        'Substitua mentalmente por um verbo sinônimo de regência conhecida para conferir.',
      ],
      porQueErrouTemplate: 'O erro mais comum é aplicar a regência do português coloquial (sem preposição) em verbos que na norma culta exigem preposição obrigatória.',
      porQueCorretaEstaCerta: '"Aspirar" no sentido de "desejar, almejar" é sempre transitivo indireto: "aspirar A algo". "Aspira ao cargo" está de acordo com a norma-padrão.',
      pegadinha: '"Preferir X a Y" nunca aceita "do que" na norma culta, ainda que seja comumَalíssimo na fala.',
      regraParaGuardar: 'Decore o trio clássico de bancas: assistir (a), aspirar (a), preferir (a) — quando alteram o sentido, a preposição aparece.',
      exemplo: '"Ele aspira ao cargo de gerente" está correto; "Ele aspira o cargo" é considerado coloquial e é cobrado como erro em provas.',
    },
  },
  {
    id: 'q-concordancia-1',
    disciplinaId: 'portugues',
    assuntoId: 'portugues-8',
    enunciado: 'Assinale a alternativa em que a concordância verbal está de acordo com a norma-padrão.',
    alternativas: [
      { letra: 'A', texto: 'Fazem dois anos que o edital foi publicado.', comentario: 'Errada: "fazer" indicando tempo decorrido é impessoal, fica sempre na 3ª pessoa do singular: "Faz dois anos".' },
      { letra: 'B', texto: 'Haviam muitas vagas disponíveis no edital.', comentario: 'Errada: "haver" no sentido de "existir" é impessoal, sempre no singular: "Havia muitas vagas".' },
      { letra: 'C', texto: 'A maioria dos candidatos concordou com as regras.', comentario: 'Correta: com expressões partitivas ("a maioria de"), a concordância pode ser feita com o núcleo "maioria" (singular), que é a opção mais tradicional e aceita.' },
      { letra: 'D', texto: 'Mais de um candidato desistiram da prova.', comentario: 'Errada: "mais de um" concorda no singular: "desistiu".' },
      { letra: 'E', texto: 'Devem haver novas convocações em breve.', comentario: 'Errada: "haver" impessoal permanece invariável mesmo quando auxiliado por outro verbo: "Deve haver".' },
    ],
    respostaCorreta: 'C',
    dificuldade: 'media',
    banca: 'IADES (estilo banca)',
    ano: 2026,
    origem: 'estilo-banca',
    tags: ['concordância verbal'],
    explicacao: {
      conceito: 'Verbos impessoais (haver no sentido de existir, fazer indicando tempo) não têm sujeito e por isso ficam sempre na 3ª pessoa do singular. Expressões partitivas como "a maioria de" permitem concordância com o núcleo ou com o adjunto, mas a forma mais cobrada é o singular.',
      raciocinio: [
        'Pergunte-se: o verbo tem sujeito? Se for "haver"=existir ou "fazer"=tempo, não tem — fica no singular.',
        'Em locuções verbais ("deve haver", "vai haver"), o verbo auxiliar também fica no singular, pois acompanha o impessoal.',
        'Em expressões partitivas, teste a concordância pelo núcleo do sujeito ("a maioria").',
      ],
      porQueErrouTemplate: 'A confusão nasce de tratar "haver" como sinônimo de "existir/ter" que aceitam plural, ou de aplicar plural por "soar mais natural" no dia a dia.',
      porQueCorretaEstaCerta: '"A maioria dos candidatos concordou" mantém o verbo no singular concordando com "a maioria", que é o núcleo do sujeito — uso plenamente aceito na norma-padrão.',
      pegadinha: 'Bancas adoram colocar "haver" e "fazer" (tempo) dentro de locuções verbais para forçar o candidato a esquecer a impessoalidade.',
      regraParaGuardar: 'Haver = existir → sempre singular. Fazer = tempo → sempre singular. "Mais de um" → singular (exceto se houver reciprocidade).',
      exemplo: '"Já fez três meses que ele foi aprovado" (correto) vs. "Já fizeram três meses" (errado).',
    },
  },
  {
    id: 'q-raciocinio-1',
    disciplinaId: 'raciocinio-logico',
    assuntoId: 'raciocinio-logico-7',
    enunciado:
      'Um edital prevê 50 questões objetivas. Um candidato precisa acertar, no mínimo, 50% da pontuação total para não ser eliminado. Se todas as questões tiverem o mesmo peso, qual é o número mínimo de questões que ele deve acertar?',
    alternativas: [
      { letra: 'A', texto: '20', comentario: 'Errada: 20/50 = 40%, abaixo do mínimo exigido.' },
      { letra: 'B', texto: '23', comentario: 'Errada: 23/50 = 46%, ainda insuficiente.' },
      { letra: 'C', texto: '25', comentario: 'Correta: 25/50 = 50% exatos, que é o mínimo estabelecido pelo edital para não eliminação.' },
      { letra: 'D', texto: '30', comentario: 'Errada: embora aprove, não é o número MÍNIMO pedido pela questão.' },
      { letra: 'E', texto: '35', comentario: 'Errada: também aprova, mas não é o mínimo solicitado.' },
    ],
    respostaCorreta: 'C',
    dificuldade: 'facil',
    banca: 'IADES (estilo banca)',
    ano: 2026,
    origem: 'estilo-banca',
    tags: ['porcentagem', 'regra de três'],
    explicacao: {
      conceito: 'Porcentagem é uma razão de base 100. Para achar "X% de um total", multiplica-se o total pela fração equivalente (X/100).',
      raciocinio: [
        'Identifique o total: 50 questões.',
        'Identifique o percentual mínimo: 50%.',
        'Calcule: 50 × 0,50 = 25.',
        'Como o enunciado pede o número MÍNIMO, e 25 já atinge exatamente 50%, a resposta é 25.',
      ],
      porQueErrouTemplate: 'É comum arredondar para cima "por segurança" e esquecer que a questão pede exatamente o valor mínimo que já garante a aprovação, não um valor confortável acima dele.',
      porQueCorretaEstaCerta: '25 é exatamente 50% de 50, que é o critério mínimo definido no edital para não eliminação na prova objetiva.',
      pegadinha: 'Questões de raciocínio lógico sobre editais frequentemente pedem o valor "mínimo" ou "exato" — leia com atenção se a pergunta quer o piso ou uma margem de segurança.',
      regraParaGuardar: 'Percentual de um total = total × (percentual/100). Sempre confira se a pergunta quer valor mínimo, máximo ou aproximado.',
      exemplo: 'Se o total fosse 70 questões e o corte fosse 50%, o mínimo seria 70 × 0,5 = 35 questões.',
    },
  },
  {
    id: 'q-etica-1',
    disciplinaId: 'etica',
    assuntoId: 'etica-1',
    enunciado:
      'De acordo com os princípios constitucionais expressos da Administração Pública (art. 37, caput, da CF/88), assinale a alternativa que apresenta corretamente todos eles.',
    alternativas: [
      { letra: 'A', texto: 'Legalidade, impessoalidade, moralidade, publicidade e eficiência.', comentario: 'Correta: são os cinco princípios expressos no caput do art. 37 da Constituição Federal (LIMPE).' },
      { letra: 'B', texto: 'Legalidade, razoabilidade, proporcionalidade, publicidade e eficiência.', comentario: 'Errada: razoabilidade e proporcionalidade são princípios implícitos/doutrinários, não os expressos no caput do art. 37.' },
      { letra: 'C', texto: 'Impessoalidade, moralidade, publicidade, eficiência e supremacia do interesse público.', comentario: 'Errada: falta a legalidade e "supremacia do interesse público" não é um dos cinco expressos no caput.' },
      { letra: 'D', texto: 'Legalidade, moralidade, publicidade, eficiência e continuidade do serviço público.', comentario: 'Errada: falta impessoalidade; continuidade do serviço público não é um dos cinco.' },
      { letra: 'E', texto: 'Legalidade, impessoalidade, publicidade, eficiência e finalidade.', comentario: 'Errada: falta moralidade; finalidade não é um dos cinco princípios expressos do caput.' },
    ],
    respostaCorreta: 'A',
    dificuldade: 'facil',
    banca: 'IADES (estilo banca)',
    ano: 2026,
    origem: 'estilo-banca',
    tags: ['princípios constitucionais', 'LIMPE'],
    explicacao: {
      conceito: 'O art. 37, caput, da CF/88 elenca cinco princípios expressos que regem toda a Administração Pública direta e indireta: Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência — mnemônico "LIMPE".',
      raciocinio: [
        'Decore o mnemónico LIMPE.',
        'Elimine alternativas que troquem qualquer um dos cinco por princípios implícitos (razoabilidade, proporcionalidade, continuidade, supremacia do interesse público, finalidade).',
        'A alternativa correta deve conter exatamente os cinco nomes do LIMPE, sem trocas.',
      ],
      porQueErrouTemplate: 'Bancas costumam misturar princípios expressos com princípios implícitos/doutrinários (como razoabilidade e supremacia do interesse público) para confundir quem decorou "por alto".',
      porQueCorretaEstaCerta: 'A alternativa A reproduz exatamente o texto do caput do art. 37 da CF/88.',
      pegadinha: 'Qualquer alternativa com 4 dos 5 nomes certos e 1 "intruso" doutrinário deve ser descartada — não existe questão de "quase certo" no LIMPE.',
      regraParaGuardar: 'LIMPE = Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência — os únicos expressos no caput do art. 37.',
      exemplo: 'Um edital de concurso público deve ser amplamente divulgado: isso é aplicação direta do princípio da Publicidade.',
    },
  },
]

const disciplinaNomeCache = new Map<string, { nome: string; assuntoNome: string }>()
for (const d of disciplinasPorCargo('101')) {
  for (const a of d.assuntos) disciplinaNomeCache.set(a.id, { nome: d.nome, assuntoNome: a.nome })
}
for (const d of disciplinasPorCargo('102')) {
  for (const a of d.assuntos) disciplinaNomeCache.set(a.id, { nome: d.nome, assuntoNome: a.nome })
}
for (const d of disciplinasPorCargo('201')) {
  for (const a of d.assuntos) disciplinaNomeCache.set(a.id, { nome: d.nome, assuntoNome: a.nome })
}

function gerarQuestaoSintetica(disciplinaId: string, assuntoId: string, indice: number, dificuldade: Dificuldade): Question {
  const info = disciplinaNomeCache.get(assuntoId)
  const assuntoNome = info?.assuntoNome ?? 'este assunto'
  const letras = ['A', 'B', 'C', 'D', 'E']
  const correta = letras[indice % 5]
  const origem: OrigemQuestao = indice % 3 === 0 ? 'adaptada' : 'gerada'
  return {
    id: `synth-${assuntoId}-${indice}`,
    disciplinaId,
    assuntoId,
    enunciado: `Sobre ${assuntoNome.toLowerCase()}, assinale a alternativa CORRETA considerando o conteúdo programático do Edital ${concurso.edital}.`,
    alternativas: letras.map((letra) => ({
      letra,
      texto:
        letra === correta
          ? `Afirmativa tecnicamente correta sobre ${assuntoNome.toLowerCase()}, alinhada ao entendimento predominante na literatura da área.`
          : `Afirmativa com um erro conceitual comum sobre ${assuntoNome.toLowerCase()} (distrator ${letra}).`,
      comentario:
        letra === correta
          ? 'Está de acordo com o conceito central do assunto.'
          : 'Contém uma inversão de conceito ou generalização indevida em relação ao tema.',
    })),
    respostaCorreta: correta,
    dificuldade,
    banca: 'Banco de treino APROVA.AI',
    ano: 2026,
    origem,
    tags: [assuntoNome],
    explicacao: {
      conceito: `${assuntoNome} é um dos tópicos previstos no conteúdo programático deste edital e exige domínio conceitual antes da resolução de questões objetivas.`,
      raciocinio: [
        `Releia o conceito central de "${assuntoNome}" antes de eliminar alternativas.`,
        'Elimine primeiro as alternativas com afirmações absolutas ("sempre", "nunca") sem exceção prevista na teoria.',
        'Compare as alternativas restantes procurando a que descreve o conceito sem distorções.',
      ],
      porQueErrouTemplate: `Esse tipo de erro costuma acontecer quando o conceito de "${assuntoNome}" ainda não está consolidado ou quando duas alternativas parecidas geram confusão na hora da prova.`,
      porQueCorretaEstaCerta: `A alternativa ${correta} reflete corretamente a definição consolidada sobre ${assuntoNome.toLowerCase()}.`,
      pegadinha: 'Fique atento a alternativas que generalizam uma exceção como se fosse regra geral.',
      regraParaGuardar: `Antes de responder questões de "${assuntoNome}", relembre a definição-base e um exemplo prático do tema.`,
      exemplo: `Em provas anteriores de bancas semelhantes, "${assuntoNome}" costuma aparecer combinado com casos práticos do dia a dia da Administração Pública.`,
    },
  }
}

const bancoCache = new Map<string, Question[]>()

// Determinístico e memoizado: a mesma pergunta deve manter o mesmo id sempre que o
// banco for reconstruído (ex.: em chamadas separadas do store), senão um simulado
// criado com um conjunto de ids deixaria de encontrar essas questões depois.
export function bancoDeQuestoes(cargoId: string): Question[] {
  const cached = bancoCache.get(cargoId)
  if (cached) return cached

  const disciplinas = disciplinasPorCargo(cargoId)
  const banco: Question[] = [...questoesAncora]
  for (const disciplina of disciplinas) {
    for (const assunto of disciplina.assuntos) {
      const jaTem = banco.filter((q) => q.assuntoId === assunto.id).length
      const alvo = 6
      for (let i = jaTem; i < alvo; i++) {
        const dificuldade: Dificuldade = i % 3 === 0 ? 'facil' : i % 3 === 1 ? 'media' : 'dificil'
        banco.push(gerarQuestaoSintetica(disciplina.id, assunto.id, i, dificuldade))
      }
    }
  }
  bancoCache.set(cargoId, banco)
  return banco
}
