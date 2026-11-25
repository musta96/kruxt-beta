import Link from "next/link";
import styles from "./MemberAccessFrame.module.css";

export function MemberAccessFrame({ children, loading = false }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/#member-login" className={styles.brand} aria-label="KRUXT sign in">KRUXT</Link>
        <span className={styles.context}>Member workspace</span>
      </header>
      <section className={styles.content} aria-busy={loading}>
        {children}
      </section>
    </main>
  );
}
