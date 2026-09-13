//! Um escritor de ZIP mínimo — DEFLATE, sem ZIP64.
//!
//! ⚠ **Escrito à mão, e não o crate `zip`.** Sem `cargo` local o `Cargo.lock`
//! não acompanha uma dependência nova, e o `--locked` do CI a recusaria. O
//! `flate2` já está no lock (vem pelo grafo do workspace) e faz a parte difícil
//! — comprimir e calcular o CRC —, então o que sobra aqui é só o envelope, que
//! é um formato fixo de cabeçalhos.
//!
//! Cada entrada é comprimida INTEIRA em memória antes de ser escrita. Isso é
//! aceitável porque quem chama parte as mensagens em arquivos de até mil: uma
//! entrada nunca passa de alguns megabytes, e no Pi memória limitada por
//! entrada é melhor que um arquivo único crescendo sem teto.
use std::io::{self, Write};

use flate2::{write::DeflateEncoder, Compression, Crc};

struct Entrada {
    nome: Vec<u8>,
    crc: u32,
    comprimido: u32,
    original: u32,
    deslocamento: u32,
}

pub struct EscritorDeZip<W: Write> {
    saida: W,
    posicao: u64,
    entradas: Vec<Entrada>,
}

/// 1980-01-01 00:00 em formato DOS — data fixa, o conteúdo não depende do relógio.
const HORA_DOS: u16 = 0;
const DATA_DOS: u16 = (1 << 5) | 1;

impl<W: Write> EscritorDeZip<W> {
    pub fn new(saida: W) -> Self {
        Self {
            saida,
            posicao: 0,
            entradas: Vec::new(),
        }
    }

    fn escrever(&mut self, bytes: &[u8]) -> io::Result<()> {
        self.saida.write_all(bytes)?;
        self.posicao += bytes.len() as u64;
        Ok(())
    }

    fn cabe(valor: u64) -> io::Result<u32> {
        u32::try_from(valor).map_err(|_| io::Error::other("arquivo grande demais para ZIP sem ZIP64"))
    }

    pub fn adicionar(&mut self, nome: &str, conteudo: &[u8]) -> io::Result<()> {
        let mut crc = Crc::new();
        crc.update(conteudo);

        let mut compressor = DeflateEncoder::new(Vec::new(), Compression::default());
        compressor.write_all(conteudo)?;
        let comprimido = compressor.finish()?;

        let entrada = Entrada {
            nome: nome.as_bytes().to_vec(),
            crc: crc.sum(),
            comprimido: Self::cabe(comprimido.len() as u64)?,
            original: Self::cabe(conteudo.len() as u64)?,
            deslocamento: Self::cabe(self.posicao)?,
        };

        let mut cabecalho = Vec::with_capacity(30 + entrada.nome.len());
        cabecalho.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        cabecalho.extend_from_slice(&20u16.to_le_bytes()); // versão necessária
        cabecalho.extend_from_slice(&0x0800u16.to_le_bytes()); // nomes em UTF-8
        cabecalho.extend_from_slice(&8u16.to_le_bytes()); // DEFLATE
        cabecalho.extend_from_slice(&HORA_DOS.to_le_bytes());
        cabecalho.extend_from_slice(&DATA_DOS.to_le_bytes());
        cabecalho.extend_from_slice(&entrada.crc.to_le_bytes());
        cabecalho.extend_from_slice(&entrada.comprimido.to_le_bytes());
        cabecalho.extend_from_slice(&entrada.original.to_le_bytes());
        cabecalho.extend_from_slice(&(entrada.nome.len() as u16).to_le_bytes());
        cabecalho.extend_from_slice(&0u16.to_le_bytes()); // campo extra
        cabecalho.extend_from_slice(&entrada.nome);

        self.escrever(&cabecalho)?;
        self.escrever(&comprimido)?;
        self.entradas.push(entrada);
        Ok(())
    }

    /// Escreve o diretório central e devolve a saída.
    pub fn terminar(mut self) -> io::Result<W> {
        let inicio = Self::cabe(self.posicao)?;
        let entradas = std::mem::take(&mut self.entradas);

        for entrada in &entradas {
            let mut registro = Vec::with_capacity(46 + entrada.nome.len());
            registro.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
            registro.extend_from_slice(&20u16.to_le_bytes()); // feito por
            registro.extend_from_slice(&20u16.to_le_bytes()); // necessária
            registro.extend_from_slice(&0x0800u16.to_le_bytes());
            registro.extend_from_slice(&8u16.to_le_bytes());
            registro.extend_from_slice(&HORA_DOS.to_le_bytes());
            registro.extend_from_slice(&DATA_DOS.to_le_bytes());
            registro.extend_from_slice(&entrada.crc.to_le_bytes());
            registro.extend_from_slice(&entrada.comprimido.to_le_bytes());
            registro.extend_from_slice(&entrada.original.to_le_bytes());
            registro.extend_from_slice(&(entrada.nome.len() as u16).to_le_bytes());
            registro.extend_from_slice(&0u16.to_le_bytes()); // extra
            registro.extend_from_slice(&0u16.to_le_bytes()); // comentário
            registro.extend_from_slice(&0u16.to_le_bytes()); // disco
            registro.extend_from_slice(&0u16.to_le_bytes()); // atributos internos
            registro.extend_from_slice(&0u32.to_le_bytes()); // atributos externos
            registro.extend_from_slice(&entrada.deslocamento.to_le_bytes());
            registro.extend_from_slice(&entrada.nome);
            self.escrever(&registro)?;
        }

        let tamanho = Self::cabe(self.posicao)? - inicio;
        let total = u16::try_from(entradas.len())
            .map_err(|_| io::Error::other("entradas demais para ZIP sem ZIP64"))?;

        let mut fim = Vec::with_capacity(22);
        fim.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
        fim.extend_from_slice(&0u16.to_le_bytes()); // este disco
        fim.extend_from_slice(&0u16.to_le_bytes()); // disco do diretório
        fim.extend_from_slice(&total.to_le_bytes());
        fim.extend_from_slice(&total.to_le_bytes());
        fim.extend_from_slice(&tamanho.to_le_bytes());
        fim.extend_from_slice(&inicio.to_le_bytes());
        fim.extend_from_slice(&0u16.to_le_bytes()); // comentário
        self.escrever(&fim)?;

        self.saida.flush()?;
        Ok(self.saida)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_tem_assinaturas_nos_lugares_certos() {
        let mut zip = EscritorDeZip::new(Vec::new());
        zip.adicionar("a.json", b"{\"ola\":1}").unwrap();
        zip.adicionar("pasta/b.json", b"[]").unwrap();
        let bytes = zip.terminar().unwrap();

        assert_eq!(&bytes[0..4], &0x0403_4b50u32.to_le_bytes());
        let fim = bytes.len() - 22;
        assert_eq!(&bytes[fim..fim + 4], &0x0605_4b50u32.to_le_bytes());
        assert_eq!(u16::from_le_bytes([bytes[fim + 10], bytes[fim + 11]]), 2);
    }
}
