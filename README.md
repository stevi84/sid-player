# SID-Player

A modern parser and player for C64 SID files using the Web Audio API.

## Overview

This SID-Player is a modern reimplementation of the classic C64 music format in TypeScript. It uses the Web Audio API to reproduce the sound of the C64 SID chip. Like the original player it displays the played notes in real-time on a virtual piano keyboard. A selection of songs can be selected from a drop down menu. Additionally files can be selected from the local drive (e.g. from [Compute's Gazette Sid Collection](https://www.c64music.co.uk/)).

### Key Features

- Supports all features of the original sid player
- Implementation of core SID chip functionalities
- Pure TypeScript implementation without external dependencies

## Live Demo

A live version of the player is available at:
https://stevi84.github.io/sidplayer/

## Technical Details

### Web Audio API Integration

The player utilizes the Web Audio API for audio processing. The following diagram shows the structure of the audio network:

![Web Audio Api Network](C64Sid.png)

### Known Limitations

- Frame drops
- Advanced SID Player features not yet implemented
- Waveforms were intendedly not exactly copied from the C64

## Installation and Usage

```bash
git clone https://github.com/stevi84/sid-player.git
cd sid-player
npm install
npm start
```

## Further Resources

For further information about the Sidplayer and C64 SID technology:

- [All About the Commodore 64 Volume Two by Craig Chamberlain](https://archive.org/details/All_About_the_Commodore_64_Volume_Two_1985_COMPUTE_Publications/)
- [Compute!'s Music System for the COMMODORE 128 & 64 - The Enhanced Sidplayer by Craig Chamberlain](https://archive.org/details/Computes_Music_System_for_the_Commodore_128_and_64/)
- [The SID Homepage](http://www.sidmusic.org/sid/)
- [C64 SID CHIP MOS6581](http://www.dopeconnection.net/C64_SID.htm)
- [Technical SID Information/Software Stuff](http://www.sidmusic.org/sid/sidtech2.html)
- MUS file format
https://www.c64music.co.uk/CGSC_v146.7z -> /CGSC/00_Documents/MUS_format_A.txt & MUS_format_B.txt

### Songs
- [Compute's Gazette Sid Collection](https://www.c64music.co.uk/)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions to the project are welcome! Please submit a Pull Request or report issues via the Issue Tracker.
