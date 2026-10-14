/* =========================================================
   config.js · conexão em tempo real e senhas do modo local
   Este arquivo fica público no GitHub: nada de senha em texto aqui.
   ========================================================= */

/* TEMPO REAL (Firebase)
   O Crowsrest usa um projeto Firebase só dele: "crowsrest-ab58b".
   (A Planta da A.C.F. continua no projeto dela, com as regras dela.)
   Os dados ficam dentro da pasta "crowsrest" do banco (CRW_RAIZ).
   Para testar sem internet, use FIREBASE = null (modo local: tudo fica no
   navegador e as abas do mesmo computador conversam). */
const FIREBASE = {
  apiKey: "AIzaSyDTC-cNLXYhYxvwGt0oN-BOOPcThuDMSRA",
  authDomain: "crowsrest-ab58b.firebaseapp.com",
  databaseURL: "https://crowsrest-ab58b-default-rtdb.firebaseio.com",
  projectId: "crowsrest-ab58b",
  storageBucket: "crowsrest-ab58b.firebasestorage.app",
  messagingSenderId: "176195044164",
  appId: "1:176195044164:web:1ca0445732b698b65e0d11"
};
const CRW_RAIZ = 'crowsrest';

/* Guardião da Luz: o UID da conta do Mestre no projeto crowsrest-ab58b.
   (Não é segredo: é o mesmo número que está nas regras do Firebase.)
   Só esta conta é tratada como Mestre pelo site. */
const CRW_UID_MESTRE = 'ggtj9tdNUFer52DfdYeeHPjTDWc2';

/* Mestres auxiliares: esta campanha não usa (false esconde a opção no login).
   Para ligar no futuro: true, criar a conta abaixo no Firebase e acrescentar
   o e-mail nas regras. */
const CRW_AUXILIARES = false;
const CRW_EMAIL_AUX = 'auxiliares@crowsrest.com';

/* MODO LOCAL (só quando FIREBASE = null)
   O site guarda a "impressão digital" (hash) das senhas, nunca a senha.
   Senha do Mestre no modo local: corvo · Senha dos auxiliares (se ligados) no modo local: vigilat
   Para trocar: no painel do Mestre, aba Segredos, "Gerar hash de senha", e cole aqui. */
const CRW_SAL = 'crowsrest::';
const CRW_SENHA_MESTRE = '32c89d5e4bf998ee332766faed6875e0ed44502d9e298bdec770c769e996621c';
const CRW_SENHA_AUX = 'c1eb7d332602a5665d0be6533f1e71599029e64edf77f891b2426296cc64df7b';
