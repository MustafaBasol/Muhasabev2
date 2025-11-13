# Proration vs Double Charge — Neden iki kez ücretlendirildim?

Bu doküman, abonelik planı veya fatura dönemini (aylık/yıllık) değiştirirken görülen “çift tahsilat” hissini ve yeni akışımızın bunu nasıl önlediğini açıklar. Metin dört dilde özetlenmiştir.

---

## TR

- Problem: Plan değişimini Checkout ile yeni bir abonelik oluşturarak yapmak, mevcut dönemi çakıştırıp iki ayrı fatura akışı yaratabilir. Kullanıcı bunu “aynı ay iki kez ödeme” gibi algılar.
- Proration nedir: Stripe, dönem ortasında plan/seat değişikliklerinde kullanım oranına göre fark (ek ücret veya kredi) hesaplar ve bunu bir sonraki faturanıza yansıtır. Böylece kesintisiz dönem geçişi olur.
- Eski risk: Aynı planın sadece interval’ini (aylık→yıllık) değiştirmek için Checkout kullanmak, mevcut aboneliği sonlandırmadan ikinci bir akış başlattığından “çift ücretlenme” riski doğurur.
- Yeni çözüm: “Yerinde güncelleme (in-place update)” ile mevcut abonelik üzerinde interval/plan güncellenir. Ardından “upcoming invoice” kontrol edilir:
  - Toplam ≤ 0 ise fatura atlanır (ek ücret yok),
  - > 0 ise sadece fark için fatura oluşturulur ve (tercihe göre) gönderilir/ödenir.
- Güvenlikler: Idempotency key (aynı işlemin tekrarlı tetiklenmesini güvenli kılar), hosted invoice dönüşünde başarı modalı, başarısız fatura olsa bile plan güncel kalır ve uyarı gösterilir.
- Zaten iki kez çekildiyse: Fazla ay için iade veya kredi tanımlanmasını öneriyoruz.

## EN

- The issue: Using Checkout to change the plan/interval can create a second subscription flow, which feels like “double payment in the same period.”
- What proration is: When you change plan/seats mid-cycle, Stripe prorates the difference (extra charge or credit) onto your next invoice.
- Old risk: Switching monthly↔yearly via Checkout without closing the existing subscription risks overlapping billing.
- New solution: Perform an in-place update on the same subscription, then check the upcoming invoice:
  - Total ≤ 0 → skip invoice (no additional charge)
  - Total > 0 → generate an invoice only for the delta
- Hardening: Idempotency keys, success modal after hosted invoice, and plan remains updated even if invoice creation fails (with a friendly warning).
- If you were charged twice: We recommend a refund or credit for the duplicate month.

## FR

- Problème: Utiliser Checkout pour changer de plan/période peut créer un deuxième flux d’abonnement, perçu comme un « double paiement ».
- Proration: Lors d’un changement en cours de période, Stripe calcule un prorata (supplément ou crédit) appliqué à la prochaine facture.
- Risque ancien: Basculer mensuel↔annuel via Checkout sans clôturer l’abonnement existant peut faire chevaucher la facturation.
- Nouvelle solution: Mise à jour sur place (in-place) de l’abonnement, puis vérification de la prochaine facture:
  - Total ≤ 0 → facture ignorée (pas de frais supplémentaires)
  - Total > 0 → facture uniquement pour la différence
- Durcissement: Clés d’idempotence, modal de succès après facture hébergée, et le plan reste mis à jour même si la facture échoue (avec avertissement).
- Si vous avez été facturé deux fois: Nous recommandons un remboursement ou un avoir pour le mois en double.

## DE

- Problem: Beim Wechsel über Checkout kann ein zweiter Abonnementfluss entstehen – es wirkt wie eine „Doppelzahlung“ im selben Zeitraum.
- Proration: Bei Plan-/Sitzänderungen innerhalb des Abrechnungszeitraums berechnet Stripe anteilige Differenzen (Zuschlag oder Gutschrift) für die nächste Rechnung.
- Altes Risiko: Monatlich↔Jährlich per Checkout, ohne das bestehende Abo zu aktualisieren, erzeugt überlappende Abrechnung.
- Neue Lösung: In-Place-Update am bestehenden Abo und Prüfung der nächsten Rechnung:
  - Gesamt ≤ 0 → Rechnung überspringen (keine Zusatzkosten)
  - Gesamt > 0 → nur die Differenz berechnen
- Härtung: Idempotenzschlüssel, Erfolgsmeldung nach gehosteter Rechnung, und der Plan bleibt aktualisiert, selbst wenn die Rechnung fehlschlägt (mit Hinweis).
- Bereits doppelt abgebucht: Wir empfehlen Erstattung oder Gutschrift für den doppelten Monat.

---

Not: Teknik detaylar ve uç durumlar için [BILLING_API.md](./BILLING_API.md) ve [RETENTION_IMPLEMENTATION_COMPLETE.md](./RETENTION_IMPLEMENTATION_COMPLETE.md) dokümanlarına da göz atın.
