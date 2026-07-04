// Curated list of breeds commonly seen on Dolomite trails, plus generic options.
const DOG_BREEDS = [
  "Border Collie", "Australian Shepherd", "Siberian Husky", "Bernese Mountain Dog",
  "German Shepherd", "Labrador Retriever", "Golden Retriever", "Vizsla",
  "Weimaraner", "Pointer", "Jack Russell Terrier", "Cocker Spaniel",
  "Beagle", "Dachshund", "Corgi", "Poodle", "Cavalier King Charles Spaniel",
  "French Bulldog", "English Bulldog", "Pug", "Boxer", "Shih Tzu",
  "Chow Chow", "Mastiff", "Rottweiler", "Doberman", "Great Dane",
  "Chihuahua", "Maltese", "Pomeranian", "Yorkshire Terrier", "Boston Terrier",
  "Dalmatian", "Akita", "Shiba Inu", "Bull Terrier", "Schnauzer",
  "Basset Hound", "Bloodhound", "Newfoundland", "Saint Bernard",
  "Mixed breed / Mutt",
];

// Brachycephalic (short-nosed) and other breeds with known heightened heat
// sensitivity — used to bias the trail finder toward shadier, cooler routes.
const HEAT_SENSITIVE_BREEDS = [
  "French Bulldog", "English Bulldog", "Pug", "Boxer", "Shih Tzu",
  "Chow Chow", "Mastiff", "Boston Terrier", "Cavalier King Charles Spaniel",
];
