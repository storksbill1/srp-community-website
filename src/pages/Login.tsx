import { auth } from "../auth/firebase";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginEmail = async () => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginDiscord = async () => {
    const provider = new OAuthProvider("oidc.discord");
    await signInWithPopup(auth, provider);
  };

  return (
    <div>
      <h2>Login</h2>
      <input placeholder="Email" onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" type="password" onChange={e=>setPassword(e.target.value)} />
      <button onClick={loginEmail}>Login</button>
      <button onClick={loginGoogle}>Google</button>
      <button onClick={loginDiscord}>Discord</button>
    </div>
  );
}
