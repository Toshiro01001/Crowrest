/* =========================================================
   config.js · conexão em tempo real e senhas do modo local
   Este arquivo fica público no GitHub: nada de senha em texto aqui.
   ========================================================= */

/* TEMPO REAL (Firebase)
   O Crowsrest usa o mesmo projeto Firebase da Planta da A.C.F., num espaço
   separado chamado "crowsrest" (CRW_RAIZ). Assim a conta do Mestre e o login
   anônimo dos jogadores já funcionam, e os dados das duas campanhas não se misturam.
   Para usar um projeto Firebase só do Crowsrest: cole a configuração dele aqui
   e troque CRW_RAIZ por '' (vazio). Para testar sem internet, use FIREBASE = null
   (modo local: tudo fica no navegador e as abas do mesmo computador conversam). */
const FIREBASE = {
  apiKey: "AIzaSyCFVn9bXN4HxBCXqZ7zl1gS4bsLHO1vaVM",
  authDomain: "a-planta-caixadefosforos.firebaseapp.com",
  databaseURL: "https://a-planta-caixadefosforos-default-rtdb.firebaseio.com",
  projectId: "a-planta-caixadefosforos",
  storageBucket: "a-planta-caixadefosforos.firebasestorage.app",
  messagingSenderId: "801839612801",
  appId: "1:801839612801:web:ce7b84b71c28d5b3a55e80"
};
const CRW_RAIZ = 'crowsrest';

/* Conta dos Mestres Auxiliares (opcional).
   Com Firebase: crie em Authentication um usuário com este e-mail e a senha
   que você quiser; os auxiliares entram com ela. */
const CRW_EMAIL_AUX = 'auxiliares@crowsrest.com';

/* MODO LOCAL (só quando FIREBASE = null)
   O site guarda a "impressão digital" (hash) das senhas, nunca a senha.
   Senha do Mestre no modo local: corvo · Senha dos auxiliares no modo local: vigilat
   Para trocar: no painel do Mestre, aba Segredos, "Gerar hash de senha", e cole aqui. */
const CRW_SAL = 'crowsrest::';
const CRW_SENHA_MESTRE = '32c89d5e4bf998ee332766faed6875e0ed44502d9e298bdec770c769e996621c';
const CRW_SENHA_AUX = 'c1eb7d332602a5665d0be6533f1e71599029e64edf77f891b2426296cc64df7b';
