import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>
            SILVER<span className={styles.logoAccent}>NET</span>
          </span>
          <span className={styles.logoSub}>Tecnologia</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Ficha Fiscal <span>Técnica</span>
          </h1>
          <p className={styles.subtitle}>
            Sistema de vistoria e controle de qualidade para infraestrutura de
            fibra ótica da SilverNet Tecnologia
          </p>
          <Link href="/fiscal" className={styles.cta}>
            <i className="fa-solid fa-clipboard-check"></i>
            Iniciar Vistoria
          </Link>
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <i className="fa-solid fa-list-check"></i>
            <h3>16 Itens de Verificação</h3>
            <p>Checklist completo com pontuação de conformidade</p>
          </div>
          <div className={styles.feature}>
            <i className="fa-solid fa-camera"></i>
            <h3>Registro Fotográfico</h3>
            <p>Captura com overlay de geolocalização e horário</p>
          </div>
          <div className={styles.feature}>
            <i className="fa-solid fa-star"></i>
            <h3>Avaliação 1–10</h3>
            <p>3 grupos de avaliação com sistema de estrelas</p>
          </div>
          <div className={styles.feature}>
            <i className="fa-solid fa-file-pdf"></i>
            <h3>Relatório PDF</h3>
            <p>Exportação completa com assinatura digital</p>
          </div>
        </div>
      </main>
    </div>
  );
}
