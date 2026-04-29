const date = new Date('2021-01-01');
const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(date);

console.log('Hijri (ar-SA):', hijri);

const hijriEn = new Intl.DateTimeFormat('en-u-ca-islamic-uma-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(date);

console.log('Hijri (en):', hijriEn);
