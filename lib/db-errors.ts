// Maps database errors to French, user-facing messages.

type DbError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

export type MappedError = {
  /** Form field the error belongs to, if any. */
  field?: string;
  message: string;
};

// Codes raised by our SQL functions (raise exception '<code>')
const FUNCTION_ERRORS: Record<string, MappedError> = {
  forbidden: { message: "Action réservée aux gérants et au propriétaire." },
  invalid_quantity: { field: "quantity", message: "Quantité invalide." },
  product_not_found: { message: "Produit introuvable." },
  product_inactive: { message: "Ce produit est archivé. Restaurez-le avant d'ajouter du stock." },
  serial_duplicate: { field: "serials", message: "Un numéro de série est saisi deux fois." },
  serial_count_mismatch: {
    field: "serials",
    message: "Il faut exactement un numéro de série par unité.",
  },
  serials_not_tracked: {
    field: "serials",
    message: "Ce produit n'est pas suivi par numéro de série.",
  },
  serial_not_in_stock: {
    field: "serialIds",
    message: "Une des unités sélectionnées n'est plus en stock.",
  },
  negative_stock: { field: "quantity", message: "Le stock ne peut pas devenir négatif." },
  reason_required: { field: "reason", message: "Le motif est obligatoire." },
  empty_cart: { message: "Le panier est vide." },
  duplicate_product: { message: "Un produit apparaît deux fois dans le panier." },
  insufficient_stock: { message: "Stock insuffisant pour un article du panier." },
  invalid_discount: { field: "discount", message: "Remise invalide." },
  discount_too_high: { field: "discount", message: "Remise supérieure au plafond autorisé." },
  total_mismatch: {
    message: "Les prix ont changé depuis l'ouverture de la caisse. Vérifiez le nouveau total.",
  },
  invalid_payment: { field: "payments", message: "Paiement invalide." },
  overpayment: {
    field: "payments",
    message: "Le montant payé dépasse le total. Enregistrez le montant dû, pas la somme remise.",
  },
  customer_required: {
    field: "customer",
    message: "Choisissez un client pour une vente non soldée (crédit).",
  },
  customer_not_found: { field: "customer", message: "Client introuvable." },
  sale_not_found: { message: "Vente introuvable." },
  already_cancelled: { message: "Cette vente est déjà annulée." },
  tracking_change_with_stock: {
    field: "tracksSerial",
    message: "Impossible de changer le suivi par numéro de série tant que le stock n'est pas à zéro.",
  },
};

// Codes whose `details` carries the product name
const PRODUCT_DETAIL_CODES = new Set([
  "insufficient_stock",
  "product_inactive",
  "serial_count_mismatch",
  "serial_not_in_stock",
  "serials_not_tracked",
]);

// Unique constraints -> field + message
const UNIQUE_ERRORS: Record<string, MappedError> = {
  products_sku_key: { field: "sku", message: "Ce SKU est déjà utilisé." },
  products_barcode_key: { field: "barcode", message: "Ce code-barres est déjà utilisé." },
  categories_name_key: { field: "name", message: "Cette catégorie existe déjà." },
  serial_units_serial_number_key: {
    field: "serials",
    message: "Ce numéro de série existe déjà.",
  },
};

export function mapDbError(error: DbError, fallback = "L'opération a échoué. Réessayez."): MappedError {
  const message = error.message ?? "";

  if (error.code === "P0001" || error.code === "42501") {
    const known = FUNCTION_ERRORS[message];
    if (message === "serial_exists") {
      return {
        field: "serials",
        message: `Numéro(s) de série déjà enregistré(s) : ${error.details ?? ""}`.trim(),
      };
    }
    if (known) {
      // Name the product when the database tells us which one
      if (error.details && PRODUCT_DETAIL_CODES.has(message)) {
        return { ...known, message: `${known.message} (${error.details})` };
      }
      if (message === "discount_too_high" && error.details) {
        return { ...known, message: `Remise supérieure au plafond autorisé (${error.details} %).` };
      }
      return known;
    }
  }

  if (error.code === "23505") {
    for (const [constraint, mapped] of Object.entries(UNIQUE_ERRORS)) {
      if (message.includes(constraint)) return mapped;
    }
    return { message: "Cette valeur existe déjà." };
  }

  if (error.code === "23503") {
    return { message: "Élément utilisé ailleurs : suppression impossible." };
  }

  if (error.code === "42501") {
    return { message: "Vous n'avez pas les droits pour cette action." };
  }

  return { message: fallback };
}
