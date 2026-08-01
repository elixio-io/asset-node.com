<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'

const themeStore = useThemeStore()
</script>

<template>
  <div class="legal-page" :class="{ 'legal-page--light': !themeStore.isDark }">
    <PublicNavbar />

    <main class="legal-content">
      <div class="legal-header">
        <h1>Impressum</h1>
        <p class="legal-updated">Angaben gemäß § 5 DDG</p>
      </div>

      <section>
        <h2>Anbieter</h2>
        <address>
          Elixio UG (haftungsbeschränkt)<br>
          Schützenstraße 6<br>
          53111 Bonn<br>
          Deutschland
        </address>
        <p>AssetNode ist ein Produkt der Elixio UG (haftungsbeschränkt).</p>
      </section>

      <section>
        <h2>Vertreten durch</h2>
        <p>Geschäftsführer: Alexander Felix von Hohnhorst</p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail: alexander.vonhohnhorst@elixio.io<br>
          Website: www.asset-node.com
        </p>
      </section>

      <section>
        <h2>Registereintrag</h2>
        <p>
          Registergericht: Amtsgericht Bonn<br>
          Registernummer: HRB 30869
        </p>
      </section>

      <section>
        <h2>Umsatzsteuer-ID</h2>
        <p>
          Eine Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz
          wurde bislang nicht erteilt und wird nach Vergabe durch das
          Bundeszentralamt für Steuern hier ergänzt.
        </p>
      </section>

      <section>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          Alexander Felix von Hohnhorst<br>
          Schützenstraße 6<br>
          53111 Bonn
        </p>
      </section>

      <section>
        <h2>Datenschutzbeauftragter</h2>
        <p>
          E-Mail: alexander.vonhohnhorst@elixio.io
        </p>
      </section>

      <section>
        <h2>EU-Streitschlichtung</h2>
        <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr/</a>. Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
        <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </section>

      <section>
        <h2>Haftungsausschluss</h2>
        <h3>Haftung für Inhalte</h3>
        <p>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
        <h3>Haftung für Links</h3>
        <p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
      </section>

      <section>
        <h2>Urheberrecht</h2>
        <p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

