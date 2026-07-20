import { redirect } from "next/navigation";

// Fase Ações-Sugeridas-Completa — pedido do Daniel: "testado e ok, pode
// remover o painel de anomalias". Ações Sugeridas passou a cobrir os 4 tipos
// que esta tela detectava (volume_tanque, geo_distancia, hodometro,
// preco_regiao), então ela saiu do menu. A rota continua existindo só como
// redirect — pra quem tiver /anomalias salvo nos favoritos não cair num 404.
export default function AnomaliasPage() {
  redirect("/acoes-sugeridas");
}
