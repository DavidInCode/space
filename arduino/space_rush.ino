
const byte botaoEsquerdo = 2;
const byte botaoDireito = 3;

struct Botao {
  byte pino;
  char comando;
  bool estadoAnterior;
  bool estadoEstavel;
  unsigned long ultimaMudanca;
};

Botao botoes[2] = {
  {botaoEsquerdo, 'L', HIGH, HIGH, 0},
  {botaoDireito, 'R', HIGH, HIGH, 0}
};

const unsigned long debounce = 25;

void setup() {
  Serial.begin(115200);

  pinMode(botaoEsquerdo, INPUT_PULLUP);
  pinMode(botaoDireito, INPUT_PULLUP);
}

void loop() {
  for (int i = 0; i < 2; i++) {
    Botao &b = botoes[i];

    bool leitura = digitalRead(b.pino);

    if (leitura != b.estadoAnterior) {
      b.ultimaMudanca = millis();
    }

    if (millis() - b.ultimaMudanca >= debounce) {
      if (leitura != b.estadoEstavel) {
        b.estadoEstavel = leitura;

        Serial.print(b.comando);
        Serial.println(leitura == LOW ? '1' : '0');
      }
    }

    b.estadoAnterior = leitura;
  }
}
