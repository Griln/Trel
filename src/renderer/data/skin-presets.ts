export interface SkinPreset {
  id: string;
  name: string;
  category: 'male' | 'female' | 'neutral';
  description: string;
  model: 'classic' | 'slim';
  style: 'cyber' | 'fantasy' | 'pastel';
  dataUrl: string;
}

export const SKIN_PRESETS: SkinPreset[] = [
  {
    "id": "cyber-female-neon-hacker-girl",
    "name": "Neon Hacker Girl",
    "category": "female",
    "description": "Neon Hacker Girl: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABw0lEQVR4nO3aMUvDQBQH8P+9Xipm6WArCCIoBUeHDDrq5OQkOri7Ca76DVwFN3cXcXJycnXpNxAHB4W2Ci4VG0olgZa2tLmENE3S935Q7nL3+iBtenmhp2BQLq91g+YbL7eB71fVfYUMIzBHYI7AHIE5AnME5gjMKdN9PmnN5nuqdYIOEzSp2KnsnCLvdNBk4+0BlY1DOMeXxpi80qZSdlCtVoPjOP22JyhH1q8S1X19ClwDvBO4vz7z+yvLS377Wf/y26PzG+OzgOkDSHsNIFOAd4K721v4qH9jc33Vf3l9byzK1ZNVOmzgycEe7h6f+/15oaMEz9OJ96hpJ4xbV8x6TSAwR2COwJyy7VKs36xtl8aOW9bC0LHr/iENpjWFwJxOKrH3jTeaF36/Ur4KEd8aOrYsG7NAYI7AHIE5jYyL+8ClqvuB8wTmdJLJw6z+adOjt5/ohguhVuun3y8WF/223f6dWDgNxg9y3fHjmb8C7DGVodbFSPGzpEcHOp3O0HGhUAicF0IIIYQQQgghhBBCiDxRcRMktb9gVnuKCMwRmCMwR2COwJye9///TQjMEZjTcRPE31+QLgJzetoJ87a/4B8fp3q8QpjgbgAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-female-chrome-samurai-woman",
    "name": "Chrome Samurai Woman",
    "category": "female",
    "description": "Chrome Samurai Woman: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB5klEQVR4nO3aL0gDURwH8O/9eFkQZhG5IIYVgxem4cBmWljRMI0iaFBEg92i4OoEMWhwQYthySYszIUZLAbTBYuCYLBO7mTDm2534/5t9/t9YOz9+e3Be7f3B+5p8GAYZqtfffmg0Pf3Cyv7GoYYgTkCcwTmCMwRmCMwR2BO89rno9Zs1hI9Jyg/Qb0OO1tHtxh1yk/n55f3oK2eoXW14ZS10+UUDIJWvz7pOQUy42N4//j8GYDTn7LWJjrpeqbUienFa4CSngLkN9Du+MXnLi6Pd520/UkD1a+y/WQfbkq4qz1Cn5xAdnoKhztrWDLnXDGjivwG2h22Xt+cgWh3Pg3UIMFp6nibFnaD1Wo90Lkin1+IdVEkMEdgjsCcVi5fB5qzuq7/Wz47a7jyT09NJMFrTSEwp6Jq2H7ieWveSVf1B8/4RqPmyudyJuJAYI7AHIE5hSGX+XKvDWEjMKeibNzP6p80ZVkWwjwIVSrnf7ay31tcsbjeM/63l5dn53u7kMVI/QOKXR20zcxkB4p3iXgNUN0Fjca9K5/LLfatN814DixCCCGEEEIIIYQQQggRBi1oA1HdL4jrThGBOQJzBOYIzBGYU2l//++FwByBORW0gaD3C4wMEkVgToXd4KD3CwqGuz5u3wbugfv5XK2HAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-female-cyber-angel",
    "name": "Cyber Angel",
    "category": "female",
    "description": "Cyber Angel: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3aPU/CQBgH8P89OReX61BjcGXhGzi5d8BEEydWE53cGQmDsri6sTKZOODAR2AxYXRg1hgZ2tlEDNXwFtsrKaWF5/kl5F45ynE97tJTsPA/38Zx5WYv/v3KOVIoMAJzBOYIzBGYIzBHYI7AnLL9z2fNOch3naBtFeYXOsFXdN5O3gLGPVxIV++74Zc/aXUj62wbbVvKTpkSKmdXgMFviPdZUUwbRR8hauwnnANMCcD3X4KAYNYBcWwdkPccQEkrdtoPQPARvsL4jlCJR8CkEx6fwrB2cZ74A4o+ApStAybb2ag6cWVb0wFYM98fp1pXOI7aaIcQmCMwR2BODYd+qnvWdc2/+WYpOwiQC9ucQmBOZ9Xw5Bd3Xn/jfsVev9eb7S8mPO8Um0BgjsAcgTmNgjNz2+4sEJjTWTaeZPbPmx6NRljnQqjVakzjnlcNw17veZpXrzci688bDF7C8K5+jSypfn+YaiVYqZRR5DnA9nRaL2d0Ou2FdK12GVvebN6mukAhhBBCCCGEEEIIIYTYJJW2gazOF2zqTBGBOQJzBOYIzBGY07v+/N+GwByBOZ22gbTnC8ruPvJEYE6vu8FVzxccN2/WfQkr+QFLr3cPKBAUxAAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-female-neon-street-runner",
    "name": "Neon Street Runner",
    "category": "female",
    "description": "Neon Street Runner: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB0UlEQVR4nO3aO0vDUBQH8H8ON1EKUoSIpINLwcm9Hezq4tTBgl/BxdnZwbkOXfwADh266NK1XRx1FJyLGHAQiiaFSlIsSSFJJX0kPecHJfdxckqevZdeDQnKljmO6+91WrH7l6oNDRlGYI7AHIE5AnME5gjMEZjTkn7nl+1tYK91nKDmCYoa7NTqF2D1CJSeb0PbTaDihrL75i4Oa+d+2aqcAZUuLEy2eJrEvPbu8W5/RubI+l1CSQHeCbLswpVfbh+h325ijDu/LWkekAcU1/l3ZQfm8KZ1fYnyQcn/eGWvLRiTV2rewPrJMTrd/rS8KSgpIDid9Q48ePBZn+rOQ1t0QtO0Uo0rbHuw0pNKYI7AHIE5rVhMNxfQdT2i3QjVXdfBOiS9UwjMqWUl9q74h33ql/fMx8R4x/kO1Q1jG6tAYI7AHIE5hYx7eWim2r9UbcT2E5hTy0w+z9t/3ZTrDlMl0PViqD4cfk3LhrHlbx3nZ9pWKOxExgeNRi5yeQcUZg7Q/xJl/Ct+ldRsg+u6sUPd2X4hhBBCCCGEEEIIIYTIEy1tgmWtL1jVmiICcwTmCMwRmCMwpzb9//8kBOYIzKm0CdKuL1g3AnNq0Qnztr7gF9U0eMJSQHqOAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-female-cyber-witch",
    "name": "Cyber Witch",
    "category": "female",
    "description": "Cyber Witch: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABuElEQVR4nO3az0sCQRQH8O+8RiqRgvDgJSHy4KV7hzpkxwj6D/LQn9ChP6FDf4T6FwTZreyQh67dPNSlU0RFhWyBpLGCoqa7K+v+fO8D4uzM2weDOzsPHAUbBzjpWI2f1fKW9+cKRYUQIzBHYI7AHIE5AnME5gjMKbt93mvnOA20TtBOgiYVO8eFBmK9BCr3m7YJnMSEmbYrZXvWdw5xqYC9Drrf+Vq5P2aVI+xPibYafHn76Lcfb8qYLz/jqmJOPjM2Jta7wMX1HdZWM92P2Y4L9VArOd4FehPf33W+7u2WQCR2gZ5pJh4VatYJ88ktV3VFw6j7+kQQmCMwR2BOZRMbrtZsMrE8vp+G+432J4Jg904hMKe9Smz+4iXjttsuJrdt45u/70PXqbkV+IHAHIE5AnMaIVetHrm6P1eoW44TmNNeJnfy9g+aNlruCpTRQui19fRvKxvc4tKJ7MT4QT/tJiL5BKRHJmhaoNRU8X7Sox3f+Bq6XsSS5bgQQgghhBBCCCGEEEJEiXKbwKvzBX6dKSIwR2COwByBOQJzOu7//9shMEdgTrtN4PZ8QdAIzOlZJ4za+YI/K2ZqM9srDPQAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-female-glitch-girl",
    "name": "Glitch Girl",
    "category": "female",
    "description": "Glitch Girl: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABtklEQVR4nO3aO0vDUBQH8P893EV8QfGBETqL0C7iUMnQ2c21s106dPZzODhYcSwIFTfBTbCfQCcHQQoGfFDwAY6Rxkoftok1TdLknN90cu/JgZDcB+QqeNjFge3WX7FM1/uVkVWYYATmCMwRmCMwR2COwByBOeW1zgftCKVI9wnaK8Fro1M06mAxBA6N0sA47pRtXQ8fAsuLwOMzsJIBVPG7za50YqvcyfnnFzLxQ6Dl8vQYqOUwOzMNXJzgvZZz2vOIP3Ltbb/Z/NYmrHa8kV134lZbd07i54DCzjZu7+5RPTt34qTQoyQn6cF/qHEXNFHwta+ooxrqpEhgjsAcgTm1BtPXmF1AemD7PJZ6rl/xhCh4zSkE5nRQhVtvvG6XndhU+575TTz0XKewijAQmCMwR2BOY8JdWXu+7ldG1bWfwJwOsvhfZv+o6Rc0MM6NUAM3v5ay7iUujczQ/G4faCKWX0C67wFbZpAaKT9Mur/hE28911OYc+0XQgghhBBCCCGEEEKIOFF+CwR1viCsM0UE5gjMEZgjMEdgTif9/78XAnME5rTfAn7PF0SNwJwed8G4nS/4AkisYBM3F4lJAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-female-cyber-priestess",
    "name": "Cyber Priestess",
    "category": "female",
    "description": "Cyber Priestess: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3avU7CUBQH8H9P7o4DAxODqQkOLiwsdXBwkoFBHVxciIk8Aawu9AnYXZwcYXJwkIXFxUQGmZhILIk+gaaQRgrS0vQLes5v6Wnv5aQX7lfC1eCj0+n+eJVfneQ8P793eKxhixGYIzBHYI7AHIE5AnME5jS/dT5ujUY11X2C2qTSus3Ow/M3Mj0Ebi/3Z9dcyYB5/z67LsaLdXaV8tvKOmq1GwwGQKXyFzu8cmx7LyGvwu/P6Tzo9Vp2wyv6EJgOZ19Cxeq1XHV2lPY1fNloEnzsPuG8eroS+/HrATsxCdrsBtsNd+KsUEEqZ6nhDi3qhM1mJ9S+wjQbiQ4JAnME5gjMafX6Xagxm8/n/31eLB647sfjD6TBb04hMKfiSmz/4u12eRa3Wq++9UejN9e9rh8hCQTmCMwRmFPYcs3rcHOBaXqXE5hTcSbfZPZPm7IsC1FuhPr93spStrjEGcbZ2vqLJpPxPAg5BBLvAcZSA22FQjFQ/SSp5Qejkbvb6nrZs7xUKsX1bkIIIYQQQgghhBBCCBE5LWyCuM4XJHWmiMAcgTkCcwTmCMyprP//74fAHIE5FTZB2PMFaSMwp6JOGPR8AXAR9SsE8gsuPHgWP8IDygAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-female-neon-neko",
    "name": "Neon Neko",
    "category": "female",
    "description": "Neon Neko: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABzUlEQVR4nO3av0/CQBQH8G9f7g8wpjFMmhgSmdsBBkbDKqxODiy6urAwubA4GBMmZhYHMHEyDg4MLGXGxEUmQojxP8AUBClga9Mf/Hjvs5Trvbz02rveNZwGD6NideQaUDZcq7WjjIYNRmCOwByBOQJzBOYIzBGY0zzn+agvoHa11nUCgTnlGVE2YBauVlZZjSpw08E2U65L2QMdGAxnRcuyYJrm7Dh2n3PELNnwG0R+gt9eH1C/Lf02fueHwGA46+r1x2ecHB+Oy9cXeZyf5Rwxu/sO+GE32L4J09+7QnkF2J+zo4/2aFXD5+u2lRZ2wna+FOiGZJqVWNcFBOYIzBGY056yxUBjVtf1lecNfTJlTnWGPayD1zuFwJyKKrH9xDONSS9oF7yffqv/7ihnE0nEgcAcgTkCcwobLn2XD5agWXGtJjCnokz+n7f/uqneMNj3/OJCqNZtLU1l81NcMZX9M35e96s/PqYRcAjE3QOKCw20pfYSvuLjpBZPvHw6FySn+0nXegOpqK5NCCGEEEIIIYQQQgghQqcFTRDV/oK49hQRmCMwR2COwByBObXr//97ITBHYE4FTRB0f8G6EZhTYSf0u7/gMuwL8OkbDvVy0qCwTOUAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-female-cyber-assassin",
    "name": "Cyber Assassin",
    "category": "female",
    "description": "Cyber Assassin: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAByElEQVR4nO3av0vDQBQH8G9eLiB1iIgOgoOji13cBAcXC/4BDvVfEByc+ic4OLi4KTi4uDgUhILgIKiLiy79HxQxg0WIaSUplKY/ctUkTZv3PlByyb08uGsuuZAzoGHbC62o+vurk8jzi6U9AxOMwByBOQJzBOYIzBGYIzBn6J7zaXOc90znCUoXoJvobO4eILdDoH57Edp/LFVC20Ex08Z4qV0OHQKL83N4+/gMymvbZcBYB1rPwfa1dtgX858rJOshQFGVvQ2rnpVRPT9ud8KQmNw+BY4q+1hZXgp+fjkv1KiBO1sbuLl76JTzgnQB3a+zfsO7Gz/pr7qjMJJOWCjYseYVjYYz1k4lMEdgjsCcYVmFWGPWsqyBx4nM0H6z6SELunsKgTmVVmL/H/9adYLybN3WxnueG9o3zcFXVtIIzBGYIzCnMOGerk9jnV8s7UXWE5hTaSYf5e6fNeW64cdP3ImQ6353yqbZ7l/P++mKnxkan8XESSWdsLeBPiL1p/hxUv2Henve1NQLIYQQQgghhBBCCCHE9DDiJkhrfcG41hQRmCMwR2COwByBOZX37/86BOYIzKm4CeKuL8gagTmVfMrpWl/wC7qHbuHwFMJ6AAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-female-digital-diva",
    "name": "Digital Diva",
    "category": "female",
    "description": "Digital Diva: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAByklEQVR4nO3av0vDQBQH8O89ziUIDtbBpW5ShDpUUDexioPWf6C7q4sOunXrUv8AcdCp4Gx1E3FToSJ0EhxEBwfrIEgXh0gbq02pSUuSNua9z9L78XrkSLm89E7BhXmVMh0DjIJjt5pOK4QYgTkCcwTmCMwRmCMwR2BOuT7ng76A+duB5gm652+0Jz61bfxnBOa0Yyo7Ngq8vlnl5CKwcQ0czFmfmzWrfeLwN6aTkP9CqKuop9ouKhcoL9+hfLxvTb7eFgHk2Nu8s3EjXzw7bxRnpibRKMeNvC0m6mtAdnUJ94/PjcnXy1GhewmO0sSblN8DmiVveYXK9DcvIDBHYI7AnDKP4t7eBWKxzu3JYXu98oFBcFtTCMzpwEau3/G1lFU+vXUNP7l5t9XXZ0fQDwTmCMwRmNMIu7jzzpO7tGMvgTkd6OhdrP6DplGtws9EKFd8+Slnvh9lpZZHXC47/md8q/KD9Y9TbgeBUmbB8JYJJhII8xrgtjut2xv2Lj9t9a2FIef+gOcvhBBCCCGEEEIIIYQQflJeBwjsfEGfzhQRmCMwR2COwByBOR31/X83BOYIzGnPI3g9XzBgBOa03wP2fL5gxe8r6M0XZXZqOLN4JpgAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-female-cyber-medic",
    "name": "Cyber Medic",
    "category": "female",
    "description": "Cyber Medic: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB0ElEQVR4nO3av0sCYRgH8O/78E42F7jYX2BbiCBBS4U/EBFa2gLXWqLZP8ClWQgaHGqR8IisMQcbXOofqCZR16TN0FAx9E65Oz3veT4g9/54fPA9fd87uVfBQix20DPrr5YKpu/f2N5R8DACcwTmCMwRmCMwR2COwJyyus67rVZ7Up7+BVRLhak3O7Pa1w2Zdb4834wrse540LHu9Jg1pL4/32ZOgcDWJrqtNgKhMHKvuUFbMVIcla+CZ6OYWQ5PLjw9BbRZ53Bgj7fXyCKKo3Qc+Gki+xH9CwiOY3x9FdiL7qLZag8G23/1y/02P9DzBh6n47i7fxiV/UIvEuyngQ8ppxP2ej1b9xVKqaUuigTmCMwRmFP1et3WnI1EIvAyqzWFwJx2Nfvw5M9xYahUKhP1VCqFZSAwR2COwJyGx3W/3l3NT2BOu5rd3t+CpdCdTsfRhPl8flROJpODo2EYU/un1YcajcbgeHmahZuUYRi2vqZEIgEvrwFWT6f1/4ZyuTxRz2Qypv1unwAhhBBCCCGEEEIIIYRwkrKbYNX7C+zuKSIwR2COwByBOQJz2u/P/60QmCMwp+0msL2/IBjCKhGY004nXHR/wX743OmPsJBfsNSHMDMO9ZsAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-female-neon-biker",
    "name": "Neon Biker",
    "category": "female",
    "description": "Neon Biker: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB00lEQVR4nO3av0sCYRgH8O89vVoehBAn5GJrcw5N0RroEo3NBf4D/Qn9C5EtLY3hotAaLS621qqLQ0cQgZYWxqlpSt6dnHrePc8HhPe9e+6B9733x4GvBgfbqWTH7v5D4cr2+UQ6q2GJEZgjMEdgjsAcgTkCc+RlCwwDze9GPtfqvn4nKLeB4x88e4cnCAPlpuHGTgb5Yw2nN73BYpWfqh2Yj6XAd4T2UilOnAKGsQHTfO12AC76IzXXGZTN3eIgZhKnDvJ7CpDryFwH5c1LlAv5XidYv7BPAbP/Zq2hfnt3j6OD/W798vxsULZ7+0Gg3AZaDbY64bccFmqa4DA1/Jc264SppOFpcajVzYUuigTmCMwRmNOMuO5pzuq6/u/11WhkpP7ZasMPTmsKgTk1r8TWG69mzG55q2Q4xjc/WiP12FoUi0BgjsAcgTmFJVcpXnt6PpHO2t4nMKfmmdzN6u831Wg0MMsPobf3Yb7Yam8ra34Ot7j4+uT4v1rtLwRyBMTHGmiJRtVU8Yukxi+0v0frkRX7+0IIIYQQQgghhBBCCBEkmtcE8zpfsKgzRQTmCMwRmCMwR2BOhf3/fycE5gjMKa8JvJ4v8BuBOTXrhEE7X/ADjiV9ky3dnG4AAAAASUVORK5CYII="
  },
  {
    "id": "cyber-female-cyber-queen",
    "name": "Cyber Queen",
    "category": "female",
    "description": "Cyber Queen: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABtUlEQVR4nO3av08CMRQH8G9fuuvgAiZsmruBhcWFxVkHXJ11kNlB/hEWmFldNOzGmcXhNMaFRIyRxb8Ag0TggGvP9H4A732WXq+Pl7ty1zZQBYtRgJExYCcwNquir7DGCMwRmCMwR2COwByBOQJzyjrPp30BPnJdJ+hYUVGLnW8f2/0KHA5D1cb1Q6hcFbNptG0pO1XwUKt6QAGTEs+zNlOONX9KyNj6+TUpe2+NcbFb7uLlsYujq9m5acyGUqNBEGsQ7Nze4fzsdOnYyvIE5D0Iqrgd8HfjY7Fvfhs6QBX9yBhT28Z0ABJ2gabTuqKNeqYdQmCOwByBOVXDjdM7u4fSyvMFHITqH3hFHmxjCoE5nVbi8TfeCuq/x5d+0xrfx1OoXkIZWSAwR2COwJzGmmsNjp0+3y6a2wnM6TSTxxn986aH6CPJhVAP90tT2fwUV8FJZPy82XW5vQKZPwGVhRs0rRaj4rOkF0+8I/z73j58Y7uHalrXJoQQQgghhBBCCCGEEIlTrgnS2l+Q1Z4iAnME5gjMEZgjMKe3/f9/GwJzBOa0awLX/QV5IzCnk0743/0FefsB4a9sf9nXJnwAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-female-pixel-punk-girl",
    "name": "Pixel Punk Girl",
    "category": "female",
    "description": "Pixel Punk Girl: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABv0lEQVR4nO3bv0/CQBQH8G9fDmZjiHGHGAanLnZgNG4mjv4B/SPY/QecnFiIiyNEJ6IbQ12cCcGYMBljHBxlwLQQAo3eQcq1tO99lrvePV76i94BhwODKfyprn8y8rWvL9c8BzuMwByBOQJzBOYIzBGYIzDnmMZ56zuAVqbzBGUKME10SrUW2LwFyk+dlbIIlO4Klw4qwMfnrF49AapACbMSr/Og7yYm85g83iG0SXDQHeC528Y0PAkFQbrO5St7e30Vle5xfVGPx+QRrRt4eX6G4dsYd/e9qF4UyhQQfpz9GQXRUBk/8OW+vHK2nTDARaIT4qGT6ryAwByBOQJzzgMaid6zFVT+bHdj7S/IZrg0PVMIzClbicMr7gWzYTPwesb4PoYr2w0cIQ0E5gjMEZhT2HHuqJksQU3/3QWBOWUz+TpP/6ypccIJSnwi1MJgUW/gMCr7eF+0+aj/G79sMG+/Qc7uAD92gKE69jaKT5OKNzzia2X7FPvaftfWngkhhBBCCCGEEEIIIYQFTtIEttYXpLWmiMAcgTkCcwTmCMypov/+b0JgjsCcSpog6fqCrBGYU9tOuOn6Av1/0uz7BU1XZNfZ3mnYAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-female-cyber-fairy",
    "name": "Cyber Fairy",
    "category": "female",
    "description": "Cyber Fairy: cyber female imported from custom skin folder",
    "model": "slim",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3av0/CQBQH8O+9nAsOMHRx1qGLi02EQWPiRIKDg3FgdjJxYnFxcdGBP8GBicE4YsJkYnRAE4yJiwP+Bwww2BUjRkKhttS2UHjvszTXKy/c70t7Cj4avVbPKz9rG56/V8sZhQQjMEdgjsAcgTkCcwTmCMwpv3U+bjm1puamB2Rtw3fjM2+0V2YWq4DdhbW965rffLgDUmk84QPzSnu2aMqZbDabsCxrcP3lFeMp1UaSkWeu3R27NVp4t2cWZggMd/Xq9c2gsKWTYxQPD7AIVO+zM/Eq0K8EIFDh/YbArFcBFaQC/iPxFYCI1TqNUBW6l8lNtUIIzBGYIzCnKq1aqDFrGO6boPX0hiP91n3BLPjNKQTmdFyBv1u8kP5p9duusze4ea4/OtKb+S1MA4E5AnME5jQSrrBkxhqfwJyOM/gks/+s6XY73Bub0Y1Q9fJqbCkbXuKKp0d/Pj+s9frevxbOyoiTKjcqoXaCpmkmeg7w+zqtR2/cV+uO9E4x75lvnsdbAUIIIYQQQgghhBBCCBElFTZAXOcLpnWmiMAcgTkCcwTmCMzpRf/+74fAHIE5HTZA2PMFWMFMEZjTUQcMer6gdLEf9V8I5Atj8Xe0QiLBFwAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-neon-samurai",
    "name": "Neon Samurai",
    "category": "male",
    "description": "Neon Samurai: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABxklEQVR4nO3asUsCURwH8O/9eIMeUkFH5JAQONiqEA5NNjW0ugX+BbW09BeE0NRQazS61phNDS665hCtQhhUyOlWKCSe5T3lvDvP3++zPN693/28xz3fe+gzoGFZyW+39lrl3PX+dKFkYIERmCMwR2COwByBOQJzBOYM3Trvt3a7Feo+QekCdBudfPEMUaamCSqeXv57vXJxjKhTbm94Y30Nb+8fw3q9XkculxuWfa/Va0dM1EYIzRL8cFtG+aQ47PwyUG6Nv2+2P9TvqjVsb20O6kcHuzjczztiosp4ebzRrgKThrFugnS7d1FWAQJzxrwTZjJZT/uKZrMR6IggMEdgjsCckUplPH1nTdN0aUsMStvuICy6OUX5+eFhdnxays/kz3uNQbnzlNXGdjqfjnoisYogEJgjMEdgTmHB3V95+80hXSi5thOYU34mn2b2D5uybRvz3Ai1260/S9noEmdZyYnxo3o9b88V2giwxjrYF4uZM8UHSY1f6Ha/HPV4fMW1HbD8eTIhhBBCCCGEEEIIIYTwgeE1gZ/nC4I4U0RgjsAcgTkCcwTm1LL//69DYI7AnPKawOv5grARmFPzTjj7+YJw/QAzCXSM+ZSkXAAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-cyber-gladiator",
    "name": "Cyber Gladiator",
    "category": "male",
    "description": "Cyber Gladiator: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB1klEQVR4nO3bMU/CQBQH8H9fbtXEpCYiSRcZSJzsggOTAzOLDK6y4CqJjI6asLPgF2BidnBigKV+ARxoQnBoYuIX0FASUtC24FEQ3vsl5I6764ODXu9oDgMxLOvkK6q+Va9EHn9eqhr4xwjMEZgjMEdgjsAcgTkCc0bcPJ80133b6DpBLdIobLFTqjbAYgjkLm/Rdvb8NJjfBUa3VQ8dAubBPi6uHzEY9NHrTcpyOUzzpVIGL0938D4+Q18g7izZiiHQuL+ZfiBuF5Ed3rkh0KpXYJ+e+J22jg/9xzg/Lov7IbQNVFRl8Jsu5M/w3Hmd5n9rs43UMo2DHd8VxqoDlss1rXVFs/mw1osigTkCcwTmjGKxrDVmTdMMrUulLD8djdw/xy8XwuMvIu6epEKCdDq+LirJ4LZd9FPHace2dd3+zHPLymAdCMwRmCMwR2COwJxKMvgiV/9NU57nYZULIcfp/JjKglOcbedD2wd53vskU5hMpVtzBthzHRwzzaOl2q+Tmi8YDmcXJOl0JrI+m80m9d6EEEIIIYQQQgghhBBi5QzdALr7C2pXejdVdf+TRGCOwByBOQJzBOYIzBGYIzCndAPo7i/YNAJzatUBl91fAGx2g8Q3DRZ6EMDzhGcAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-male-neon-street-punk",
    "name": "Neon Street Punk",
    "category": "male",
    "description": "Neon Street Punk: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABxklEQVR4nO3aPUvDQBgH8P893BRKE0odurgJRWiRuHZxseDsl3HwA7jrKLgWnIUuvkDByQ76DVw6CNKUkrWSKJJG8lLz1vZ5fsuF3pNrLr0nuaOnkGCxwCKu3nkbxp5vdfsKa4zAHIE5AnME5gjMEZgjMKeS3vOFX4BCpfMEnSYoarJjdvrY+hRwAp23nvtLZdIscBOo6eswMgXMnQacj8/v484xvNHqZYxXTn86H4z5zyipOgVoleDHwSWeBlf+TdgWFFcZ/GWvL8788mB/7/c4HLN1KRB2e/fgl6cnR0hr41PACixnvY4HO7/uS900VN4N2nYv0wNiPB6VelMJzBGYIzCn2m07U84ahhFZV6uZfjmfO6hK0jNFF/nlVXY8LV1k4+OXkV/ah73EWMdZnlCZZgNlIDBHYI7AnMaau785z3S+1Y1fixCY00U2nubpXzXtui7ynAhNJu9/XmXBV1yrtRsZH+S6c2zkCGiFOugxjNpK8WXS4Q9ms+UJSb3eiK1vNptFXZsQQgghhBBCCCGEEELkTmVtoMj9BWXsKSIwR2COwByBOQJzetv//09CYI7AnM7aQNb9BVUjMKfzbnDV/QVV+wIaEnb/OQzA+AAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-cyber-knight",
    "name": "Cyber Knight",
    "category": "male",
    "description": "Cyber Knight: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABx0lEQVR4nO3av0vDQBQH8G8eNzmVErCt4Jw5rpl10KGLbm528D/QoZMgXcStIK1/gpjBybmbpXNHKYgVQulfoJJAS1vtJSXND/LeB8pdci/XpL3LXcgZCGHbzo+u/KXT1B5fOzgykGME5gjMEZgjMEdgjsAcgTkjbJxP2mDQy3SeoMICFic6J42btftYdIEd6zy4+LO7dxSF0k1ld80yvrxJkK/ah7AcP0WQAq/B/rfn+3nMf/LeQmiT4IfjPr5HfXQuURgUNbB9ex380/7HzxeF0hXOmvasGT8+9eZlft7vPrrmX4gWUNM8zub9UTcKY9sV1usXseYVrttN9UclMEdgjsCc4Tj1WH3WNE1NWTVIPe8TWQm7p6gkvzzLC49KJVn51VUnSFutRmjseDxa2q5U9pEGAnME5gjMKeRcu3ka63jX7WrLCcypJCuPcvfPmvI8D9ucCA2Hgz9D2eIQZ1n22vhF0+nsvOJ1gdRbgLVygb5SydwoPk1qdcdk8rG0XS7vacsBK5kzE0IIIYQQQgghhBBCiAQYcStIcn1BGmuKCMwRmCMwR2COwJwq+vv/MATmCMypuBXEXV+QNQJzatsVbr6+IFu/sBt50zUDsVwAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-male-digital-drifter",
    "name": "Digital Drifter",
    "category": "male",
    "description": "Digital Drifter: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAByklEQVR4nO3av0/CQBQH8G9f7g9Q0qCEBBMnFhcWHYwji4M4qoMLCw46uDiog3FwcXCRhVUcxZXROOji4uJkIglRSYP+BxhqNAXtr5S2wHufhNy193rwmubuGk6Di0J+sePUfna063j9zMKqhiFGYI7AHIE5AnME5gjMEZjT3Ob5sNXqt7GuE5SXILvFzs7hKUYdgTnltJRN6pNY29o365n5Asooo4SSWS7fp8zzl+fHaBkftn0M+1OivdxddZxugDW550bTLGczadsYvzcg7jGAnBqtiV3Xb8zEu59u/b+YUaS8Bq7kl34T79bHhfITPE6J/9AG3WFxvRBoXVGp1iIdEwjMEZgjMKcFfRfQdd22LZX8bnttGYiL25iiwvzyOBP3SoXZefFizywrGyeusY3mW89xJj2NKBCYIzBHYE5hyB1sbwa6vlKtObYTmFNhdu5l9I+bMoxgc3X/Qujh8enPVGad4nJzWdt4K6P9iZF8AnJ9CXbpiQlf8VFS/Sea7+2e4/RUwrE9G+/vF0IIIYQQQgghhBBCCF80BBTm/oIo9hQRmCMwR2COwByBOTXu//+7ITBHYE4F7SDo/oK4EZhTg+7Q7/6CuH0BioF2drJSap0AAAAASUVORK5CYII="
  },
  {
    "id": "cyber-male-cyber-detective",
    "name": "Cyber Detective",
    "category": "male",
    "description": "Cyber Detective: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB5ElEQVR4nO3av0sCYRgH8O89vJNZgj8QhySooYYklHCoFhuKaAjaaumPKGiLtqCp/6CltqghoqWWWhxsqKFmFwtT0MzGwiMkJe9OzvPU5/mAvPfe+9xzvsd7ry/4ajAxGY18G7XfXZ4YXh+KpTT0MAJzBOYIzBGYIzBHYI7AnGb2O++0l2zO1XWCshLUarGzsLqJfqesBC1tbWNQKaOlbDAUwFRyuV7PZDJIJBL1suY5fY33fKFljl4fJVr+8fbb7AEc7O3o9XAooJdvvx3e3T+0/QDcngPIStDc7Axe8wVMjI3qn9px7dwg0IxGQLOzqxu9XF9ZtHyDXh8Bqp3gdjreL7ROJ5yPT9taV9w/PHV1RBCYIzBHYE6LT47bemc9Hk/LNp93SC9LlU+4xWxOUU7e3M2OW6WcTL6xltTL04u0aWyxVG6o+30j6AYCcwTmCMwp9Ljz4yNb14diKcN2AnPKyeRWZn+3qWq1ik4uhLK5t/qx3zesl8XSR/1cNBJuGf9XpfqFvhwB0aYO1ngNVov/xXeTaj5RLFca6v4Rr2F7MBh06rsJIYQQQgghhBBCCCFEx2l2Ezi5v6Abe4oIzBGYIzBHYI7AnBr0///NEJgjMKfsJrC7v8BtBOZUpxO2u7/AbT/lln3Dj8oaxQAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-neon-viking",
    "name": "Neon Viking",
    "category": "male",
    "description": "Neon Viking: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2UlEQVR4nO3aP0gCURwH8O/9eEsRGVJgEFFEYERLiw42tNTSUENLSw4tLe0NQU0tTUFbQy0tIjm01BJEg0VEW84tBYl0ETUaZyVqeM86z/Pu9/uA3Dvfz588ff/EZ0AjuzJZtKsPLa7Zvn5sNmmgjRGYIzBHYI7AHIE5AnME5gzdOu+2+P6tp/sEpQvQbXTM1C4CPwSiM8u4OE+WrpXlIDDuTw/qDoG+cA+eCy9fjb367qmxYrmcMw/KMf/tIV4PAWo4MlZE+mYT6b2trw/BegSAsqv8+WZzZ4c4Oc9ieCCC8dEh7KyvYm46XhXjV6qRIKsbT1mFPGDeoVQ2U9faCdIPCMwZzU44n3C2r8hctnZSJDBHYI7AnJGYGHE0ZntDIZu6rtI1b77BK7o5Rbn55l42vFHKzeTHS7el68LRpDb2qWBW3UfC9XtWMxGYIzBHYE6hzW1vOPu9kZlN2tYTmFNuJm9k9veaypvVy4/TjVDu4fHXUla5xEUH++vGV3p5e4cve0C0poGWnq7OP8W3kqp9ovD6UXUf7u6wrRdCCCGEEEIIIYQQQgg/MZwmcPN8QSvOFBGYIzBHYI7AHIE5FfT//3UIzBGYU04TOD1f4DUCc6rZCf12vuATphp+rYTEzZwAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-male-cyber-engineer",
    "name": "Cyber Engineer",
    "category": "male",
    "description": "Cyber Engineer: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB10lEQVR4nO3aL0wCURwH8O/99hJzwiYGi0m3M1iuYIDApkkCwWRGg9lCcrNQKBaDYLAbDJg0ErRccRM3G8WgBJyz6jimO9D7w+6OA36/z8be3b0fP+7Bu3vvxtPgoVTMfrnVVysV1/en1nIaJhiBOQJzBOYIzBGYIzBHYE7zGuejVr9qxjpPUH6CnCY7h+UyWF0ChYvHgXIWKLepbHJxAXul/f62noVezCKpwyqBpnW8Vj9D97XjmGPSewmNElxbaQGdFmoZzAzyCvjpIefVI+uX7r162/a6aabcKu1de6ewhcvGze/2fzEz2QNStsfZXsPtjZ/0R10/tLAT3p0ageYVGwfmWL9UAnME5gjMaY1jPdA1m04nHOuM1TmrNJ8/EBeve4qK8sPjbLhfKsrkGcOwynvT9IxtPnQH9rPrSYwDgTkCcwTmFCacnj8JmCHnWktgTkWZ3M/dP26q/faJMCdC9euXP0OZfYgrbS85xts9tfvnVc1junpAaaiBPfpyYqT4cVLDB27N94H9TWPetd7Q01GdmxBCCCGEEEIIIYQQQoROC5ogyvUF41hTRGCOwByBOQJzBObUrP//74XAHIE5FTRB0PUFcSMwp8JOOOr6gt2wT2BE34t7crrsB9BmAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-male-neon-assassin",
    "name": "Neon Assassin",
    "category": "male",
    "description": "Neon Assassin: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABzklEQVR4nO3aMUvDQBQH8H8el1QCUpE6FBz8AnZxUTcXC+Li2n4DcXPqJxBBVzfdOjtUhC66qYuLfogOFlGEokmh0ogx1jZXSdO0ee8H5a65l0suyV0v9Axo2Ha2E1Z+d34Sun+hWDYwwQjMEZgjMEdgjsAcgTkCc4budz5urdZrovMEAnNKFxCc6d0WK1irH/hp1+rOLqaZ8VCvDuwCC/NzeHp+8fLLmyXAWAE69176WN//E9OP7gJNVReonZZQOzv+uggpQWGFwTt7WNnD0mLe+3Tz/WJSOQZ829pYx+X1jZ9PC9IFBF9nuw0PNn7SX3WHYYy6wlwuH2le0Ww2xnpRCcwRmCMwZ2SzuUh91jTNkDLLS13XQVJ0Y4qK8+BJNnxYKs7KL5p5L93ONbSxjvP+67tlzWAcCMwRmCMwpzDhrqpHkfYvFMuh5QTmVJyVDzP6J025rotRToRarTc/b1kZL3WcD3+bbc8OjA9qt6OdV2JPgN3TQO8gyvpX/Dip3g2u+3O3ukwzE1oO2PGcmRBCCCGEEEIIIYQQQsTAiFpBnOsLxrGmiMAcgTkCcwTmCMyptP//r0NgjsCcilpB1PUFSSMwp0Zd4f/XFyTrE1QqdXjl62VBAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-male-cyber-dj",
    "name": "Cyber DJ",
    "category": "male",
    "description": "Cyber DJ: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpUlEQVR4nO3aPUoDQRTA8f8+plCxkLgQFdHCJlaCEQSx1sbCxhvYeAOP4BUEbyCohY2NpSAkgoWYE/gBURRE7ZRNlQ+yE1032fW9H4TdZN68MGS+2EyAxyLbX3Hlp9Wt2PpT5fWADBOUE5QTlBOUE5QTlBOUC3zrfNquOBjoPsH5AnwbnY3yIXkmKBfcVc+6DoFiWOCx/ty4n1xcg+ASvpYb1/vqa0fMb3pI5odA5KJyDZVrikfjcHzD4/4TVGBlaYG8k16CooZGv/Lc7HTjFd3/h8Z7h4CvG/smyLi6WRkCgnLBXycssZloX1HjpK89QlBOUE5QLphhNdGYHSH0lr1TZ1B8c4pL88sH2fBeuTST37LbuM6z541946Hl/SgT9IOgnKCcoJwj486rO4nqT5VPYssF5VyayXuZ/QfNJV2r2zdCdWodS1nzEhdS6hrf7JMXctkDwrYGRoYY+1F8P7n2Dz5ofb43TCG23BhjjDHGGGOMMcYYY/IkSJogzfMF/ThTJCgnKCcoJygnKOf++///PoJygnJOw1nAOIJy7q8T5u18wTdPq2J3bYD+XwAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-cyber-marine",
    "name": "Cyber Marine",
    "category": "male",
    "description": "Cyber Marine: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3avUrDUBQH8H8OdwqlRYlKpw46dHFJF4eCg9CpYH0BcXZwcnbo7CKIsz5BdXDpJujYvIEOghQ/UFpKViWBfkqThjRJm3N+y016T25z2jT3kF4NPsyy+evV3zivex5f2KlqWGAE5gjMEZgjMEdgjsAcgTnNb56PmvVoJVonqKAHTBY+B6dnWGZqpih7uHlwPEy4ceVdBS4D5VXKrhur+Pj6HiTdarVQKpUGrePp+tKNmWbRrxAKEnx/c4H6yeEg+TRQXp39b9a51O+aD+72dnELR7U97Fd2x2KWFc0a6CT88vrmfhD95NNABQlOU+J92rwHNCvh6gqrGW9dQGCOwByBOa1YLob6zeq6PrUvs5Jx295PD0nxu6eoKN88ycRnpaIc3KyZbmvdWr6xnc/O2H5uLYc4EJgjMEdgTmHBNerhnjkUmlXPfgJzKsrBZ7n7J03Z9sjzrjkUQu3n9r+pbHSKy2/mp8aPsrvhziuxKyA/kaBDz+qB4uOkJl/ovnfH9rMbWc9+wzCiOjchhBBCCCGEEEIIIYSYOy3sAFGuL4hjTRGBOQJzBOYIzBGYU2n//98PgTkCcyrsAGHXFySNwJya94BB1xck7Q8liXYUDEwJ+QAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-neon-muscle-man",
    "name": "Neon Muscle Man",
    "category": "male",
    "description": "Neon Muscle Man: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABaUlEQVR4nO3bIU/DQBgG4PfenN6ATKOnMVRMo5CAI0GAxiD4EfsHmCnENjlFcEx0vwAMgmkCdGJ2pBssg6zbSAe0fb8nafL1+vWSa+/aS3N1WKJW3R4tOt5p1BeevxEcOWQYIY4QR4gjxBHiCHGEOLfsPf/bug99l+ke0GnU5052ksoLOQTKu4c4rvRxd/803uI4LisC9xY2E4dAubKJ6Pl10tizj556NZrG0WlzmpNk/+Qi00PAr5wZN/zxdrLFcazXQt75VZKiXgvtmy4O9mrj/fb1+TQu9AWIZrp23OD4InzG83LyyP8kuSh3fZZbd4VhGKaaVwRB8KcPRUIcIY4Q56rVnVRjNmxcIsuWfZMkxBHiCHGEOEIcIY4QR4jzw+EQyghx/nvBYPDyZb9U2lp43BhjjDHGGGOMMcYYY/LEpa3gv9cXpP0niRBHiCPEEeIIcYQ4QhwhzqetIO/rCwhxft0V5m19wTscUWI3tQnFDwAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-male-cyber-pilot",
    "name": "Cyber Pilot",
    "category": "male",
    "description": "Cyber Pilot: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB3ElEQVR4nO3av0vDQBQH8G8eNzkUrakKIghV6FLBLi5ddOjs4tKuLrq4dBSHbkIXF8W10I5SUBAcdHHQxUEXQRwFbWOV/gNKI5X+TFLSNG3f+0C5JPdy7V2T3B05DTYS8diPVX7+OGt5fmhlQ8MQIzBHYI7AHIE5AnME5shNFzgONL8reXX74Os4QTkNbB3wpHbTGAeql4rvFV5wlFw20/rxUW8Irfx43fUW0EPTMMqff9vRdZzcAztrMNOtiZu2mE7sGsjvW4B6CV4t5XB3njMbYVyQVWbjP3t6uI+lxQXzU9vuFDOKlJOg+mV8dnH5f6y2bTcTHAVkF2A1nR32qa4TWr8LTGwmXY0rroqFgTYqgTkCcwTmtFg84eqe1XW9a96UPmOmX0YJfrF7pigvv9zPijulvCw8k82b6UE6ZRtbfn9r2g/NzWMQCMwRmCMwpzDk8pltV+eHigXLfAJzysvCnTz9/aYMw0A/B0Kvz09tXVljFxeORLvGN6p+VzCSV0C4pYI1gclgT/GDpFoPVCsfTfuB4KxlPhDx5pcJIYQQQgghhBBCCCGEBzS3BXi5vmAQa4oIzBGYIzBHYI7AnBr39/92CMwRmFNuC3C7vsBvBOZUvwvsfX2Bv34BoCd8CdehRfIAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-male-neon-thief",
    "name": "Neon Thief",
    "category": "male",
    "description": "Neon Thief: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB4ElEQVR4nO3aPUvDQBgH8H8ervZFUKwiiFKRFlwcFAQX6+YoWL+CX8KP4OIkjo5ddRAH0UknQXBxcegigiBaUbAvVlCSSk2LeZE0TZPn+UG4S+7JU65c07v2NDiYGEt/2bVfHO7b3p/LFzT0MQJzBOYIzBGYIzBHYI7AnOb0Pe+3h6dyoPME5SbIarKTL2yC1Ucgd7zTVkaBspvKjo+OYHZlw6hnl9eB2DGyS80SjWbM7fkBHp9fLHP0+yhRboIur2+M43R0HmelPRSfp3GJG0QBOQXoI2RpYQ6PT2XMZCaNQ6/r15wWQmGg7BrNQ3ttdQVHp+et+l8xkRwBOdNyVu+4ufP9vtR1Q+t2wmxmytO8onR339M3lcAcgTkCc5rXtUAqlbJsS8TjRlmr1xEUp2eK8vPFg+y4W8rP5KWtRaPMbl85xr5Xq23ng8kkeoHAHIE5AnMKfe6kuOvp/ly+YNtOYE75mdzN0z9oqlKpoJsTofLr229bMmGUlWqtdS09PGQZb1b/+PnJKWwjIN3RQV1iYOBf8b2kOi/UG59t5/GYsm0XQgghhBBCCCGEEEKIMNG8JvBzf0Ev9hQRmCMwR2COwByBORX1//+dEJgjMKe8JvC6vyBoBOZUtxOGbX/BN0tdetTPQpvHAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-male-cyber-overlord",
    "name": "Cyber Overlord",
    "category": "male",
    "description": "Cyber Overlord: cyber male imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABn0lEQVR4nO3aMU/CQBQH8P+9nBqKCQuauOhABwcXWOQTOOnqR3PW1Umjk58AFxxd6qCLibKQ6BF1wFjEQEl74FFK+95vuZZ7feSFu94lnIKFh2o/qf81uE58vuw3FZYYgTkCcwTmCMwRmCMwR2BO2db5tBl0Mt0naFuAbaOz4R8izwjMqfegFTsFvM0qzEtncF3bB5QC+v2wNUFrIuY/I2Tpp8CQebjF3cUpcHmG+m/xRUBJnaO/7PnVTdjW93b/rqMxhZsCUcPCj48OMK3CTIFZC88LNe+E22g47Sue0F7oiCAwR2COwJyqouY0Zz1UYvvWsB62H3hDVmzvFJ3ml2dZ+LR0mskf0Q7bHTSssT10x+5LCSNrngjMEZgjMKex5O6DE6fny34zsZ/AnE4z+TRv/6xpE1l+XDdCXTxPLGWjS1wFW7Hxoz5hkMsRUIkU+GMV3kzxi6SjH3yhN3a/glJivxBCCCGEEEIIIYQQQuSJck2Q5vmCRZwpIjBHYI7AHIE5AnO66P//2xCYIzCnXRO4ni/IGoE5Pe+EeTtf8A2Pg2ITQM9QugAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-neutral-neon-drone",
    "name": "Neon Drone",
    "category": "neutral",
    "description": "Neon Drone: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABoElEQVR4nO3aO27CQBAG4N+jPQFyEYREReHablJEokBKReFDuMoJUlFQcQCUyidIlYIqHVIk0sAJkgYJkcLiColMBMIE/Mj6AZ75mmW9o4FF9u4g1kCCyeT9Gxr6/VsDF4zAHIE5AnME5gjMEZgjMGfo7vO6qq4TCMypNEGDwcPJ68PhE64dxQ02GmakP5/PI+2pmGtDWYJns0+Mx89wHAcsHoHNJtjf6tPp677f67nodu8jMbVeA0LhhMMvYfe6LlSW4DpNfMfIO6HnPWrVFb4/KrUuIDBHYI7AnOG6ntYza5rnC6Fms71t1+slqpK0pqgi37zKiaelikzue+629fyXxNjl8iPSb7c7KAOBOQJzBOYULpzr/q4j/+X7o9hxAnOqyORpVv+qqSDQ+z1/XAgtFm9/trLDLc62787GHwqCr1wegdLvAPtogiHTvMkUXyZ1fGG1ihYkrVYndtyyrKI+mxBCCCGEEEIIIYQQQuTO0E1Q5PmCMs4UEZgjMEdgjsAcgTlV9///kxCYIzCndBPoni+oGoE5lXfCrOcLqvYD2iBlrFEXTj4AAAAASUVORK5CYII="
  },
  {
    "id": "cyber-neutral-cyber-mannequin",
    "name": "Cyber Mannequin",
    "category": "neutral",
    "description": "Cyber Mannequin: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABq0lEQVR4nO3asUrDQBgH8P99XB3i0A59A9EOIoJLXyH6ACKuBV+hVUFQUOsrCAVBKOIDaF6ho4iD0MWli0s7mMEOlaa2NWKbyKVJ2u/7Qbm73HG5fHC5Cz2FAL3Pjx4MqKVlhRQjMEdgjsAcgTkCcwTmCMwp03XeeAAJ7xMIzFGoVhkLhydXXurLL/wUyFhA1/XSRuPZu1QsbozzWyvjNnM6BVTYAPS9vjx5aWF9c1A/rJvjANDU2uGDdV3Ub29QWFv1fv38zzo2q0D97t5L9/d2oxtAqqdADBIPACLWbpsFNJeLNyAE5gjMEZhTrda70Zy1rMk7wmx2UNfpJLdUBr1T9CxvnuSDh6WREo7z4Cvb9k4s9yUwR2COwJxGyn0vJDNDYI7AnGo234w2Qvl83leuVs9Hedve9lLHeRxdq1SOJ7b/y+WZv33UX5sq6gCk7R0QFAD9+0Ktdu0rl0oHU+vL5SOzEQohhBBCCCGEEEIIIUSMlGkHszxfEMeZIgJzBOYIzBGYIzCnF/3//yAE5gjMadMOXNf0LGCyc4DAnI66w/+eL7g4TfZ8wRcHunOZ8+95zQAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-neutral-pixel-character",
    "name": "Pixel Character",
    "category": "neutral",
    "description": "Pixel Character: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABxElEQVR4nO3az0sCQRQH8O885i+ICEIQIiEPnTyEB6F7GXiMTh300h8Q/RmdgtKDJ/FedKlL4EE6eOpg0EmIQMR/YcIfmBv7S3bHVd/7gMzuztsnu86OTxyFAOVC2vj1V+t3vuerTFFhhRGYIzBHYI7AHIE5AnME5lTQ97xttVYv0TpBhwnyKnYql1dg9QioTNHRbgLtW8rubKFycj7Z3j91tlPV5ybQH3qmWPVRQosEd1/u8fn6AGMSnTaWeAP6w9nz37i9xsFeavwabY+M+3w+/XWgwwZenB2j8fg2294UOihg9HPWfD0Ztwuf71tXKvaM5Xa0G1LLL7UuIDBHYI7AnEKpHu2Z3c569+3mJu1PB4kJmFO01TdP8sJD0jaTm2p+3KpKOzj4o+ncP5yW4JYRmCMwR2BOY8WZm0Gk81XNv5/AnLaZPNTsnzCNQRexFkKduTGXLkzaXuvvWK7sHe96vIT1GgG5fxcYVC26xTtEmwMWvwHf78791JF/f9buJySEEEIIIYQQQgghhBBxUpEz2FxfsIQ1RQTmCMwRmCMwR2BOb/r//0EIzBGY05EzRF1fgOkagoQQmNOxZ1x0fUHCI+AXVOxjL0LLRNYAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-neutral-neon-abstract",
    "name": "Neon Abstract",
    "category": "neutral",
    "description": "Neon Abstract: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABsUlEQVR4nO3av0vDQBQH8G8e5yKCSxAc7KJCBrvEoRmci1AEZ2dx6F/gbP8Bp04O9k8QFaSzQxcL0kXQSYeKZBHcHCpNIW1C07RcftS891nepfe45tI072jPQIxO520ADY6zY2CJEZgjMEdgjsAcgTkCcwTmDN06ryvvdQKBOVok+dm5CsTCXwDT3PDblco2znDsx2k5hb8DWtefaLVugEEFRUGzOl33y283GpdetKw9vx3OKXwVaLdvvVitHvGpAs7ECQ4nPjn5vE8+CUbSAzbtjta6ot51Mr2oBOYIzBGYMy5Kd1rfWdM0I/t212wvvv50kZe4Z4pK883znPi8VJqD159Gsbkfn9v7eAwcl7cOkAUCcwTmCMwpLDm7GV1l5uLM7iYwp9IcfJ6nf96U67pIciF03x//XFZeH5Wy3ve4xNU2T6fnhz6K9/6LF22c41/dAbXQBIdKq9ZC+VlS4Re6vw+BY3vlcGa/hejJCSGEEEIIIYQQQgghxLIxdAdIc39BFnuKCMwRmCMwR2COwJwq+v//cQjMEZhTugPo7i/IG4E5lfSAi+4vOEE2GyKj/AH2h1+2bLHUkAAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-neutral-cyber-skeleton",
    "name": "Cyber Skeleton",
    "category": "neutral",
    "description": "Cyber Skeleton: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABlElEQVR4nO3av2vCQBQH8O89bqqDGZzbQYf8EVmaFndB+mcIHYVOQueCf0YJuLhU2nR16VRHHdrZIQ52TTFtQxU1yuWH5L0PyLvLHc9ciHcJnkKCIFiGMGBZFYUTRmCOwByBOQJzBOYIzBGYU6brvKminxMIzBGYo32N1erZWtmyKnHc1qfUd8Bi8YUw/JkugmCJsqCkQf/xvMeovvqsytv6lH4V8H4H3m7flGYVUNyXQZV2wun0w+iCNhoXuV4QAnME5gjMqfH4zeg3W6vVdrbV6+dRnM0+UZSkOUVn+eVFDvxQOsvko9FrFJvNy8S+vv+8Vnfda+SBwByBOQJzGidu3yqTBgJzOsvkh8z+RdPz+TzVW7Tff4jLrnsVRd9/iY91Orc7+/83mbxHsde7R5bUcPhk9CRo2zZOeQ5Iet3WmwcGA2+t3mq197Z3u3dGJyiEEEIIIYQQQgghhBB5UqYJstxfkMeeIgJzBOYIzBGYIzCny/7/fxICcwTmtGkC0/0FRSMwp9NOeOz+Asdx0j6Fo3wD2c9m+RC5CSwAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-neutral-neon-robot",
    "name": "Neon Robot",
    "category": "neutral",
    "description": "Neon Robot: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABrUlEQVR4nO3aMWvCQBQH8H8e9wGkODgUl2aQQncHoVuXOvgNzODiLiUfIYJfoJ30G3SwS7eCg3uhU7pIBwcprp1SEqpYW43hkpzmvZ9D7szjmcsldweehRjD4TiABsdpWjhiBOYIzBGYIzBHYI7AHIE5S3ee12V6nUBgjg4NdL6a/5ZPndp3slQ6w3L5iXb7Fk7YcDQRIFiXh6PxOqbwT0CAAF7/Hv3+Q1QOP4V/ApY/PTsaPWE6fUG9fh3Vu927dfmUez/2BmwKGxzehFW5KFSS4CI1fMVKO6HrDrQGB8/r5bouIDBHYI7AnNXpuFrvbLlc3nmuWr2IjrPZO0yJG1NUlj9usuGHUlkm91q96Og+DmJjff/tV922L5EHAnME5gjMKRy5Wq2WaX4CcyrL5IeM/qapxWKBNBdCk8nzn6lsc4prNG52xm+azz9yeQVU2gm3GxiqVM4TxedJbX/h+6+/6rZ9tfd81j0khBBCCCGEEEIIIYQQabJ0E2S5vyCPPUUE5gjMEZgjMEdgTpm+ANN/rRGYIzCndBPo7i8wjcCcSjth0v0FQCvtS0jkGxTIbCMKmpz+AAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-neutral-cyber-blob",
    "name": "Cyber Blob",
    "category": "neutral",
    "description": "Cyber Blob: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABoUlEQVR4nO3ar2/CQBQH8G9fzmNIQGFoMsQSRINDTWAWEmbRVYiZGeaQ2E2g0NjxF0whlpC6mSXFoBAY/gKWNmGhDCjN9Qf0vY85rvfy6JH27iWcgRCj7WgLDT2jZ+CKEZgjMEdgjsAcgTkCcwTmDN19XlfWdQKBOXVJ0NgaH71uOzZuHZ0bLKAQ6DuOE2iPxdwaihI8+BmgPWnDsiyweAU22Pw96vPJHKW7kt+vv9TR6DYCMbleAzzehL0fYfc5L1SU4DxNfMeIO2Hf7WvVFUNzmGpdQGCOwByBOcP+srXe2WKxeHKsUq347XKxRFbC1hSV5JdnOfFLqSSTd6odv50upqGx7qcb6JsPJtJAYI7AHIE5hSu320mSQmBOJZn8ktU/a2q9XiPOQmj2Pvu3le1vcc3n5sn4favvld9237q4qSegeTBBT/m+HCk+TerwgvtxUJA8mWfHa6+1pO5NCCGEEEIIIYQQQgghYmfoJkjyfEEaZ4oIzBGYIzBHYI7AnMr7//9hCMwRmFO6CXTPF2SNwJyKO2HU8wWtx1bctxDJLyj1XSwqYvx6AAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-neutral-neon-ghost",
    "name": "Neon Ghost",
    "category": "neutral",
    "description": "Neon Ghost: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqklEQVR4nO3bPW7CMBQH8L+fvLdDbtDFC1MlyIDEhjowMOcAHZk7l6EdOEGnsDAzMFRsbBESUiVWjsDQnoCKIPHVEoOcD8J7vwEbYj1iy7GdYBQsomi1ggPfVwpXjMAcgTkCcwTmCMwRmCMwp2zz/HoeP1Um6VhZ1glkK5BUQdfKl+4S8P2Pg/QWUNJBz9vla7X16/M2/a/MzfeAMJyh35+h/B3/zAZYLnf5bncQp8Y8bvPHZcpIXTKQjcebijebQWonUPQsoLhPgyrtgKPRt1ODtFr3uTYIgTkCcwTmVBgunK5ZL2ElVKncxel8/oOi2MYUneWXF1nxc+ksgw+Hmx7QbtsbYjr9PHhfrT4hDwTmCMwRmNO4cp63GUeyQmBOZxn8nNG/aHrpeEN/vBAaDN7/TGX7U1wQvJwsv2+x+IrTTucNWVK9XuS0EjTG4JrHANvttj7+YDLZPe1ZazSCxOPGvDqdoBBCCCGEEEIIIYQQQuRJuQbIcn9BHnuKCMwRmCMwR2COwJy+9d//bQjMEZjTrgFc9xcADygSgTmddsBL9xfU6/GfkArzCzOMdz0/ELluAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-neutral-cyber-toy",
    "name": "Cyber Toy",
    "category": "neutral",
    "description": "Cyber Toy: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABi0lEQVR4nO3bsXHCMBQG4F/vNAIrcEdDQ4MnoCFZwBuEgoYFOKjTkg1YIKFhAprQUAINtXcQl9hHsAMInywb/N7XSEY6Id6BnnwWChZmtTJwoIJA4YERmCMwR2COwByBOQJzBOaUa553nkDF+wQCc5SnswqCVFn/ADQaf/VuN11e6lP3b4DZ7YD9HsZUumyUGIAoOlXn02l8HUVx/UKf2meB+XL5W4a9Xm2ygLIF4GeC1/rcanuaAKBgZjZzC8hgUGpACMwRmCMwp8xk4pbUb22Ems243G5RFduaor2+e4Uf/F7a6+hv67j86Fi7fm42qevXdhtlIDBHYI7AnMaj69jXDxcE5rTX0e9Y/aumne/nMxuh8WJxqr8kqezrLMWN+/2r/c99Hw5xu+efgDLDodtOsNWCV44BsN1u6+wL7+tk85IYZSbwr913AIQQQgghhBBCCCGEEKJAynUAr+cLSjhTRGCOwByBOQJzBOZ03Z//2xCYIzCnnUd48v8LEJjTRQ+Y+3xBGBY9hVyOj9xlUbfY7BEAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-neutral-neon-sphere",
    "name": "Neon Sphere",
    "category": "neutral",
    "description": "Neon Sphere: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABq0lEQVR4nO3bv0/CQBQH8O+93C7DxZGEaGIXFwdhaOJmSNR/gNnZmdkFB/8EByb+ATEhbCYOxcGYuGACMXE0HfAvwLSYWEUo5PqD9L1PAle4y6MtvXsHHAoxvNF0Cgu1XaWwwQjMEZgjMEdgjsAcgTkCc8o2z9vKe55AYI7AnF5WabYB/2O2Xd0J7oOrNegxCoPxdK5N4U5A1GAMvL8NAbyiXMl12MiuC/iRd7Z/20G5shfegu3/2hQ+C/S/D/z4rFGYLKC4p0GVdMCuN7E6oae1UqYnhMAcgTkCc6rdHVn1WWPMwrr9g62wfHn6RF7ixhSd5ovneeCr0mkGP0EpLO8wiW37+ND79fjQrSMLBOYIzBGY09hwxswySVoIzOk0g68y+udN+76PJCdCnZuruVQWTXGN8+bC9lGj4XNYXjRbSJO6bntWM0HHcbDJY0Dcx23994n73s+3PYGjemNpveNcWu2gEEIIIYQQQgghhBBCZEnZBkhzfUEWa4oIzBGYIzBHYI7AnC767/9xCMwRmNO2AWzXFwDhX1FyQ2BOJx1w3fUFrltNehfW8gXD0GRhIGIHpgAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-neutral-cyber-plant",
    "name": "Cyber Plant",
    "category": "neutral",
    "description": "Cyber Plant: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqElEQVR4nO3asWrCQBgH8H8+bnISyeDkEgpZuhS6BQoOLnZw8gl0sA/QB+jUJ2ih+hAOdXHrA+jSRSgunRyCOLm2JGKJtpqEMzmb7/uB3J338ekdMXfBsxCj89r5gobB7cDCGSMwR2COwByBOQJzBOYIzFm667wu0/sEAnOUNHD8OP6zXugJKFVKYdlv9mG7NqbD6U49GlP4K2DSn8C5dtB+aYf14FUE6ljnerkOy+6oi/nbHM6NE7br9/Wf+jamkBMQFQw4mIRtvShUmuAiDXzLOnXC1lNLa18xvBvmui8gMEdgjsCc5T14Wr9Z27YP911s+vwPH6bE3VNUlh9ucuBJqSyTN3qNsBw/xz87LN4XO+3qZRV5IDBHYI7AnMKZs2uHV5lTIDCnskye5O5vmvJ9vbV6fyM0G81+LWXRJc5tugfjo1afq7D0eh7+1RXg7g0wUK6VU8XnSe2/sZwud9qVq8rRfpj9/kIIIYQQQgghhBBCCJGKBU1Zni/I40wRgTkCcwTmCMwRmFNF//8/DoE5AnNKN4Hu+QLTCMypUydMfb5gc5bSmG9jW2ZURc0K8wAAAABJRU5ErkJggg=="
  },
  {
    "id": "cyber-neutral-neon-cloud",
    "name": "Neon Cloud",
    "category": "neutral",
    "description": "Neon Cloud: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABsElEQVR4nO3av0/CQBQH8O+93ISDSxMCq0sXmjg5SMLkyMDCf6AJs644uLvC4OLgxMLA1JiQMPgPlIQ/gYaE1a4aSoxVgi25/sC+91nuuF4e7aW9d9BTiLFcvn/AQL1+onDECMwRmCMwR2COwByBOQJzyjTPmyp6nUBgjpJ0qtUq6N69hGW0XvoBqFa/L9Ju3uB6uFuP9vmPdNKOTz3Add/gupv6Zdjm+yj3HbBaBWHp+wEGg+ew7jjnYX3TFu3DIguMx6Ow7HS6pckCinsaVGkH9Lyl0YA6Tj3XASEwR2COwJyaTj2jZ9ayrL3HGo1aWM7nxS0Y4uYUneWXF3nhSeksgweV7R1QCeIHYjZ7/fG51bpCHgjMEZgjMKdx5CzrNNP4BOZ0lsGTzP5F0+v1GmkuhIbDx51UFk1xvd7t3v5Ri4UXlv3+A7KkRqOp0UrQtm0c8xwQ93Nb/26YTLZ/enxpt7t/Hrfte6MTFEIIIYQQQgghhBBCiDwp0wBZ7i/IY08RgTkCcwTmCMwRmNNlf/8fh8AcgTltGsB0fwFwhiIRmNNpBzx0f0GzeZH2KRzkEx63bT+MwUJHAAAAAElFTkSuQmCC"
  },
  {
    "id": "cyber-neutral-cyber-heart",
    "name": "Cyber Heart",
    "category": "neutral",
    "description": "Cyber Heart: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABo0lEQVR4nO3aMY7CMBAF0O+RT4Co6ZBoaMgBKJBogAvsDaCgoUco/XaII+wFFg5ARRUaSjpqxBWyysIiwkIMckxCZl7jOB4NTBTZRljBIJzPQ1hQ3a5CjhGYIzBHYI7AHIE5AnME5pRpnY/W8XsxSWPvsk8gU0BSgbbF54F+JMgbj2/eD3wf744SR0ulWDcIglh7K6bYk+BqhWA6hed5KAqdOHo4nF/1r+Xy3B+1WvhoNmMxhZ4DIlHBvw/hdF0U9MwyFRV+WXzWS1gaVNoJw9nMbl8wGLz0oRKYIzBHYE6Fvm+3nS2X749Vq8d2u0VWTHOKdvrpGRb+KO00+3p9bBsNY+j3ZhPr9+p1vAKBOQJzBOY08q5ScZqewJx2mv2B2T9rGvs90twITRaL83X3tJTNL5a4SadzN/5SsNsdx/t9uKTC4dBuJ1irIc9zgOknu76+8fm3eTkZXb3G/8ZdPwAhhBBCCCGEEEIIIYRIkbJN4PR8wQvOFBGYIzBHYI7AHIE5XfT//00IzBGY09YZbM8XZIzAnE474dPnC9rttL/CU34AZ0Nqzh2sGPAAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-neutral-neon-star",
    "name": "Neon Star",
    "category": "neutral",
    "description": "Neon Star: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpklEQVR4nO3aLU8DQRAG4Hcn60FUY1pCDaamFSgEBkggQfUHIBA1KFxTDAaDQJBgK4AEQTEIdE0xYBqoQVfALzjS3qW5Nu1tL3tf3MyTNLvtTbbbSbOzl1sFA+en68CCWq0pZBiBOQJzBOYIzBGYIzBHYE7Z1nnrCaS8TyAwR2GCby5qU23+E7BS8PWrOD7wtfNi8v4P6Os79Hv3QDXVZSPBBPwOJ9327Tk2Smvj16g/Lyb3VaD98DJu60c7uakCypSA0QQXxQRd+zcJQMScr2u7hJROEk0IgTkCcwTmlNNt2RX1QsBGqLjutoNPpMW0puhYvz3FH74sHevoxTe3HVSMoU+v71Pv97c3kQQCcwTmCMxpZF3BvH7YIDCnYx19idU/bRpDy/v5mY1Q8+p50t/zSlnHV+Kajd2F8X69j2/3eiveJCqn07DbCZbLyPIaYLrd1rMfXD56mxfP6WEl+PpZzAkQQgghhBBCCCGEEEKICCnbAWI9X5DAmSICcwTmCMwRmCMwp/P+/N+EwByBOW09gu35gpQRmNNRDxj6fMFWPeophPIHmWhjVQcuDhgAAAAASUVORK5CYII="
  },
  {
    "id": "cyber-neutral-cyber-void",
    "name": "Cyber Void",
    "category": "neutral",
    "description": "Cyber Void: cyber neutral imported from custom skin folder",
    "model": "classic",
    "style": "cyber",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABfElEQVR4nO3asW7CMBAG4N/HORVBKgsLHcJa3qVzH7Jz36VdyZyllaBqDGqVSK0CtATkOEa5+yQUg08XTOL4JGzQIsvuv+Ahz18NrhhBOIJwBOEIwhGEIwhHEM74rvO+YtcJBOEIwvGpztGIsdtt6/Zq9QJUN2s1YQywyJZHMYP7AZoWiyXcvATuAJslEDEFdo0ru16/w9qkflXtv2IGfQdMJre/A6/aQ8GXBA9p4D9M1wlns8yrriiKvNe6gCAcQTiCcGY6nXvNWWvtib6b+ujcJ2Jpe6ZwyJPHHPi5OGTy5+KpPj7MHltjy/Jj732SjNEHgnAE4QjCMa5cmqZB8xOE45DJz3n6x8bOOXRZCG02b0dLWXOJS9Ppv/FN223ZyxTgrhMeDrA+CScXxfeJDz9wbr8gsXZ8sh8Ie4WUUkoppZRSSimllFKqS8Y3Qcj9BX3sKSIIRxCOIBxBOIJwHPsLhP7zsw1BOIJw7JvAd39BbAThuOuEl+8viOsbwnxbK2IvLfkAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-female-elven-archer",
    "name": "Elven Archer",
    "category": "female",
    "description": "Elven Archer: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB1UlEQVR4nO3aPUtCURgH8P95OFtFEbcoihYdJIrABocKmpoKhLYWG/QT5OBHaNBPoHNbINTU1NLg0hKEgy3Ri9Qlimo2vAa+pPeqV73a8/yWe14ej/ccz7n3gEfBQalwXrINmAzYVqsZv8IQIzBHYI7AHIE5AnME5gjMKcf3fL9vwL/r6T5BO0Y4bHTwkQeLJbCVOmyaHnWq9FpovQSMWcB8AQwfYrmYVZQOpatpX6Ia0+UM8XoJqHYG4PIqZ2Unxses6+fXt3Xd3giN/ACQbe1vx8odfSpW0utrK1ba6nxNzKhStjOgwcnpmXU92N9r/xuGfAaoTgagK8M+AOixaDLsakAz8exAB4TAHIE5AnMqnNh0tWYNw2haPu+rL3++M+EFp2cKgTndr4bLv3j0KGGlM6ljx/j722Jdfml5DoNAYI7AHIE5jSGXjiRdfT4Tz9rWE5jT/Wy8nae/17RputugNG6Eri/yf15lta+44E6gZXwt8+G9kohgtGZAsKGDZcbiVEfxg6QbCx5v3uryC6vTtvUBb+9fCCGEEEIIIYQQQgghOqLgUr/OFwzqTBGBOQJzBOYIzBGY0//9/38nBOYIzGm3Dbg9X+A1AnO61w12er7Aaz+IUIUSGbhnAgAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-female-dragon-sorceress",
    "name": "Dragon Sorceress",
    "category": "female",
    "description": "Dragon Sorceress: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3avU7CUBQH8P89uWpkcQESF5hMXGBgwcT4AjIYV3dN4AlcXJx0NtFEd1bioC9ATGQhEUYnu2jAxcXPoaagfCktpLTQnvNLCLe9pyccuL0tcBUc3GZg2vVnSzXb41UyrTDDCMwRmCMwR2COwByBOQJzyuk677W1KlRgRkC2VHO88QkabdeZvXkEGk0gkcL5hkI2kWrtv4sAe2UTMOpAPIbK+jKCSpkPteGnQDzWeQOw+zNSL8xu+6DWjRmisp2e6VNA2/b2FmYV/v7UflhtizUCbIoPAhopyqijeHLcLrbRbLet4kNAjxq4s7WJ4uV1px0WepzgMBX+S0064WnC3X1FwfB3UiQwR2COwJw6jLo7Z6OR//evLPRv339gKpzmFAJz2qvE1iee38+02mdHVcf4+lv/dmoRviAwR2COwJzGjMuX3f0AU0jafx0nMKe9TD7K7D9t+vnVXYLBG6Grl7+Xst5LXG5peHwv47P9nEfARkBuoEBLYn68eD/pwR3Vr/7tzJx9/6onL0sIIYQQQgghhBBCCCG8odwm8Gp9gV9rigjMEZgjMEdgjsCcDvv//04IzBGY024TuF1fMG0E5vSkE467vmDavgHu922VdYsbzAAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-female-ice-queen",
    "name": "Ice Queen",
    "category": "female",
    "description": "Ice Queen: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB4ElEQVR4nO3bL0hDQRwH8O/7cSBYtjCUGRR14RWLwRkemBSDoIIYzCJosJgsBrMWBZOCySCCCAZBEAXDEDRoWbBoUCYLW7EsKHuKbDrfbbx/2/v9PjDu3t3tx9vuvbsb72ZAI/NY+HCqN9uLju+Pd/UYaGIE5gjMEZgjMEdgjsAcgTlDN8/7bTgVD3WdoHQNdAud7HsMbG6Bpa2zqjQKlFMPxzo7UMx955PdsKYWEEvCToFnuzzd24Zi7q1lrxBqpPFQ6RK315dYTCMyyKmysmf3draR6u+zX+V8rTatSNXbcGZ6EkfHJz/5qFC6BuWfs4WXp49aH7yyrlUZXgc8zby4+kImhrsCXRcQmCMwR2DO2D+9d3XPJhKJmuUDg8mq44e7V4RBN6YQmFN+BS73uGl+XQXZrL73b67Pq46HrFEEgcAcgTkCcwpNzuou+RqfwJzyM3g9o3/YVD6fh5cLoYPdzT9TWeUUNze/8m/7So/Zezu11pfhJ2Nj/8LVStA0TTTzGKB7Oq1+F1ydHVYdj4zPOtab5pqrExRCCCGEEEIIIYQQQoggGW4D+LW/IKg9RQTmCMwRmCMwR2BORf35vw6BOQJzym0At/sLgHD/UUJgTnkdsNH9BfNjq16fQkM+ATzcdkTUv8vmAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-female-forest-nymph",
    "name": "Forest Nymph",
    "category": "female",
    "description": "Forest Nymph: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB00lEQVR4nO3aMU/CQBQH8H9fzsQA0cR0UAcmhjL4DZh1ccDFxZg46ODC5KC7A9/BxLi4uMBgYnRmxcRJBlwcjEZiokFi4qAppKQt2oMUKOW933J33OtLDq7XA86ARv4s9xPUf756Enh9cjlrYIIRmCMwR2COwByBOQJzBOYM3XN+1Mo7lUj3CaqfoP82O1s3e5jqW6C0Xfa0swdrnvKvmLhRuq2sI7FkwcyZ3dItKMekzxIK6my9vLbLxO3DkV2erhzjrnKF6n61+5oTE1fG59N9X4vgRekSmxvrPXUd3QyIxSJoswdsD9ypTwulC7C/zjqzxD9wd19cGcNOmDu0Qr0hlWJtrLcEgTkCcwTmDGvXDHXPmqZ3U+SYTyc87ffHFqKgW1MIzKlRJbY/cStvteu1ck0b/1ZvetoLmRTGgcAcgTkCcwoT7rpQCnV9spgN7Ccwp0aZvJ/VP2qq1Qi5QfHtgx4rjZ5HmfsRl/b9muSOd2s+f3UqBcRrBqR9A7SlFmcHih8n5X/ho/7tac9lZgL70dnrCCGEEEIIIYQQQgghRCwYYROM6nzBuM4UEZgjMEdgjsAcgTk17f//6xCYIzCnwiYIfb4gYgTm1LATDny+IGK/G4R9rBn7pMoAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-female-vampire-countess",
    "name": "Vampire Countess",
    "category": "female",
    "description": "Vampire Countess: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABrUlEQVR4nO3asUrDQBgH8P993G6QFBShU8FuilmdXFwLOjn3IXwDxcEHkM5Oir6Agw8QZ1cLotAg8QkqV6GYyiVpr8ml/b7f0lzuy7X3Nbk72lMoEKI9zqsfpXHu9SpoKTQYgTkCcwTmCMwRmCMwR2BOFc3zVUsw9LpO0GWCbIudVhBh1ekynY+Ojq11q54EnbuU3QiB72RajOMYURRNX43R+C0TM6vpCaJ5guPnJ9xcX007vw7UOB2VGgRv7+6x2+kg2t+bHJ+dnpR6g6I7wPcgqMomwDAdN8p2fu0SsIjGJwBL1kPfKaGPGNSaEAJzBOYIzKlD9Jye2RCh5fx2ppzgAz4UjSkE5nRVDZtv/ByDyfEl+oXxnxhmyltoow4E5gjMEZjTaLiH9MLpehX8jkM2BOZ0lY2XGf190wnsv+YsshB6xcu/qezvFNfFgTX+r9Txc3m7A7ozHTQCy2rRFl8nPXviC++Z8iZ2cutNF4QQQgghhBBCCCGEEGJVKNcGqtpfUNeeIgJzBOYIzBGYIzCn1/3//yIE5gjMadcGXPcX+EZgTi+7wfn3F/j1A8KTa3DJdspQAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-female-fairy-princess",
    "name": "Fairy Princess",
    "category": "female",
    "description": "Fairy Princess: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2ElEQVR4nO3aLUzDQBQH8P+9nBoCxAy4BQRmliEW2BCEZMMRxAwKgcGgcAQNBoNFLYHg2BKCIOAGCQaQYAkCwQRFlqwlbF1ob6PrVvbez/Tu+nLb3XYfaU/BwK692IEB6UTgbTUyphBjBOYIzBGYIzBHYI7AHIE5ZVzno/4CsxMD3SdoY0TrRufB8i8byiGQGf9Jbq8fuw1PJ9z0LzH/kbI/3v2HQGIUsOrO9ebQLcpsoJleqzdj/Bj+IfEeApbbsKvzKpACcksFJ/+Zqn4HZIMbPyyrQG4ui5fXV7exVt1JN8qGgQocAm3KJ6fOtbS60vknxHwIqG464E/i3gHoMbvyFKpDVXGqrx1CYI7AHIE5ZR/dh5sEkz7PBNOT3vzDMwbBNKcQmNOR1dz4xQsXbrq6aAw/u7305JdnFtAPBOYIzBGY04i7fDLS6gnM6Uhr72D2HzSNt5DP9No2Qjvlg5908Xspq7QscTulTd/4VndPj+79/C6ipOy9Wrid4HQy1nOA6e20bi/Yvy578lvzpeD7095fVAghhBBCCCGEEEIIIeJMha0gsvMFfTpTRGCOwByBOQJzBOb0sL//NyEwR2BOh64h7PmCASMwp3tdYdfnCzaiPQFi8gXdMngkAnGtIwAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-female-pirate-captain",
    "name": "Pirate Captain",
    "category": "female",
    "description": "Pirate Captain: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB7UlEQVR4nO3aMUvDQBQH8H8eN4koaIq4ZFLookMddKiDLShYBUF0EZx0sIN7V5d+Ax10ElwEQdAKDrrooIMddBF0yiJiFBRxVRKotNYmrTFN2/d+S+8uL4/eNbk76GnwEDP0T7frx4e7rvdHBhMaGhiBOQJzBOYIzBGYIzBHYE7zWueDljetUPcJqpqgSpudial5NDtVTZA+MIbRhVGc7Zw59eJys1NuW1k90o2h4aRTjsajWN5YxubK5nfZdnV5AuvpuWKORn9KtKfr00+3AbA7p5sfGaRS2YuDbad9ZHoRyOUyltGWLcT8dQDCngM0twEotnd0gtnJZFnZS6MPgKo20O6w3fFCuVWoWoJbqeMF2n8nXF+K+9pXpLfO6/pKEJgjMEdgTlsaj/p6Z2OG/mt7f29nSf3u4RVh8JpTCMypoBLbv3hsJuqU8/u3nvE35ktJfcDoQj0QmCMwR2BOocHNra75uj+9lXC9TmBOBZm8mtk/bMqyPvxlMEqrubxZtpQVL3GpmFExvphpvTufc2iyJyD1o4M2Q2+vKb6e1M+G+8e3knpfT4fr9fGgvpkQQgghhBBCCCGEEEIEQPObIKjzBfU6U0RgjsAcgTkCcwTmVKv//++FwByBOeU3ge/zBSEjMKf+O2Gt5wvC9gVOeIaq+Xp1XgAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-female-shadow-priestess",
    "name": "Shadow Priestess",
    "category": "female",
    "description": "Shadow Priestess: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABxElEQVR4nO3avUrDUBQH8H8OdypiRRwsSEFaoXOXZOiiQ50EH8Klb2AXFwcdXQXxAepScFJE106dFBw6uShSxIp0raSiJLHNjaT5aM75QcnHPTklbW7uSXsNaBRRHfm133aOfI8vW9sGUozAHIE5AnME5gjMEZgjMGfoxvmoPaGbaJ2gggRNK3a2rCYy3QXue6eu7QPrzrWcFDNvlK6U/VEy66ghj5JpjpfA4LfNL0farxLya3ztv7m2N1oPuLk4R2NkTo3J7ChwctjEenFt/LLXs8Loda4CjwKX1999f6e+GfgNdF0g6VGAdAHOx1n7xJ0nn/ZH3SCMWSesYjdUXdFFO9YPlcAcgTkCc0YFtVB9NoeVifsXPPs/0UcSdPcUAnMqqsT2N76H/fH6GY618QO8uLbzWEUcCMwRmCMwp5ByrU4j1PFlq+3bTmBORZk8yN0/aWoYskDxFkLPePwzlDmHuAIqU+OdhnjHXF4BBc8J2nJY+ld8nJR3xwfcP3EtYtm3fXIhLIQQQgghhBBCCCGEEOlkhE0Q1fyCuOYUEZgjMEdgjsAcgTmV9f//dQjMEZhTYROEnV+QNAJzatYJ/zu/IGlfxdtgAfbqEMMAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-female-mermaid-queen",
    "name": "Mermaid Queen",
    "category": "female",
    "description": "Mermaid Queen: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvElEQVR4nO3av0/CQBQH8G9fbpdBjRMOMmAMiZMuJMZZEhmMgzML/gU6MLkwuJE4YaKLkyaawKwkTq4MLo1G4mCUAf8CDCWSFrQHKW1p3/ssd9d7fenvO8IZ0Cmcdd26O6Vt190Ty6sGZhiBOQJzBOYIzBGYIzBHYM7QjfO+qx6GOk9QugDtROfkHmxegcTxpaOMA+V2h+cWF/D9+dWvJ9NANj8of3Ur+4OYKD4hNEnwQ/IdjfoNusVNxAW5ddrv7Hnl1CrXM2uD+nBMFNG4gXu7OZgvr7i+q1n1uFC6gN7P2c7bszVUDp+4vS+qjKlnPKp5uyDlXKDzAgJzBOYIzBkoXHh7Z+fn/96ezDjbrSZCofmmEJhTvmVuNVHI71jV6m1dH28+OdupDQSBwByBOQJzCjOuU1zxtH+i7N5PYE75mXysr3/IFNptTHUi9Hg1OpTZh7jswf/xdh9mvyyWEK0nIDt0gj1LqcniA6RGtpgNZzu15d6fTvtxXEIIIYQQQgghhBBCCOELw3MGv9YXBLSmiMAcgTkCcwTmCMypuP//r0NgjsCc8pzB6/qCkBGYU1PPOOn6AvQXU4blB3y0ZL7EPgsyAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-female-war-maiden",
    "name": "War Maiden",
    "category": "female",
    "description": "War Maiden: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2ElEQVR4nO3aMUgCURgH8P99vJaIApHKAicHlxYlWlxatKjB1uYaWlxaanBqyLUpot0tcmiIlhaXoFxanYQwQ4QiWoKKuzDU6u7sPO+67/uB3Lv3vvvw4d29D3waLJxlo+9m44n8sen1M8mMBh8jMEdgjsAcgTkCcwTmCMxpVuu821ZLNU/rBGUn6Ldip7K3iUA/AssHJ5YJ7MT4mbIqZdsiiTSuDpNY2LoxjtGF/a8xsxx+v0vIbLDRbBnHSP11t165wPzKEd5q18bk9b7OmMCuAon8MeqRkf3T80tjsvpHb+t9du8eP1N2A9eWFo2Jt9tBofoJDtLE27RBJ9xZTzmqKwrF8lDrAgJzBOYIzGkb6bijZzYcDv/YH52c6DqvPTzCC1bvFAJzyq3E+i+eTb0Y7VJ51DK+etddUcZmQxgGAnME5gjMKfhcbjvv6PpCMWM6TmBOuZncztvfa6rZ/Fyq/qq3Dirf1r4tZZ1LXGou+mt8p/vWs3HM4Z/dAameCeqmQ2N9xQ+T6u2oNp66zmNT46bj8bhbX00IIYQQQgghhBBCCCEGT3OawK39BcPaU0RgjsAcgTkCcwTmVND//7dCYI7AnHKawOn+Aq8RmFODTtjv/gKvfQDrY3vOYPVoTAAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-female-sun-priestess",
    "name": "Sun Priestess",
    "category": "female",
    "description": "Sun Priestess: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvUlEQVR4nO3av0vDQBQH8O897k9oERdBKthugtAOLt1bQXBz0cG9g4tj/wD9B8RBBd0ExYCrg4MVCm51dPJX+z9E0hbSBtNLvaSJfe8DpXeXxxEu3N1rcwoGrgN3YkClM/GyypcUMozAHIE5AnME5gjMEZgjMKeM+3zSN1BHqnkCgTkyRniZXqWDk8elX8v/nXK7nfApkMsDvS6QKwKt9UFbpe2XC5d+TJhWKdNTQEcJeri9ANDA4kIeeLrHx1ej314tYM6nQG/wZKsbZbx/fmN1Zbn/8cpe22jMfE6BgKtrp/+9s11HZBmfAmqaAfiTrA8AYuae2eUVam+2A0JgjsAcgTnlHln+FsiFtBcD9VekwrSmEJjTifXsPfHd/UH5/NQYfvcyXt9cw0wQmCMwR2BOI+tqtv85TE7FCczpRHuPsPqnTaNn2UMgEWre+OX6cCtzRra45lZ4/Kj22/B6DYlS7qFlJhjM+DK2BpjeTutgw/HzeP2gbLie9AAIIYQQQgghhBBCCCFEjJRtB4mdL5jRmSICcwTmCMwRmCMwp+f9/b8JgTkCc9q6B9vzBSkjMKfj7nDq8wVx38CUfgANZ2Tpi00hPwAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-female-moon-witch",
    "name": "Moon Witch",
    "category": "female",
    "description": "Moon Witch: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAByklEQVR4nO3av0sCYRgH8O89vBodkYtLDoLkoNSUa5OzQS1BRFP0PzQ1REONzc0uLQUJLeHk4HJNBc0u0Y/FCCMNihMsz/ROOe9O73k+i/fe+9zDvb7nvQ/4anCQSa5+2/WXy2e21yfSWQ0TjMAcgTkCcwTmCMwRmCMwpzmt8157qFUCrROUU4BToZPP72GaKbvO+7tLPD2/oLC53be/dF5sxywtr2NaKacZ7mYYBnK53O9nh12OSX9CyK7TnP1ulZtrnJ4cWQbfGzNt1DBB5qN+cVXCYirVbu/ubGFjrYAwUMMGmgM2v4TOcVioUYLDNPAObdwJk/EVV3VF7fXW17qAwByBOQJzWlzPuPrN6rre9/xMZM7S/my9IwhO7xQCc8qrxOaM7x8a7ePjg7/KcZCPZt3Sno3G4AcCcwTmCMwpTLhqtejq+kQ6a9tPYE55mXyYt3/QVKPRwDgLoXrj8d9S1r3ExfSFgfHdml/u7iuwJyDWM0BTVOkjxftJ9Z5o4c3SjmDeth+Ie3NnQgghhBBCCCGEEEII4QHNbQKv9hf4taeIwByBOQJzBOYIzKmw///vhMAcgTnlNoHb/QVBIzCnxp1w9P0FwfoBiAZvOtdgKUoAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-female-demon-huntress",
    "name": "Demon Huntress",
    "category": "female",
    "description": "Demon Huntress: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvElEQVR4nO3av0rDQBwH8O/9vCeQIogQF4cuLnWwm5tLCzr5BHVxcBQcnBxcLUIXu/gIQgPi5tZFH0EwUAQpvkIlaQshtrmW6+Xa/n6fJZfLL0f+3T9yCgYtYJB3vNbt5J6/W60rLDECcwTmCMwRmCMwR2COwJwy9fOuXQBexwl63hOyA5+wWgebKrARDLcvZ6t902nqq9uZWgW2Spv46f8m6eCwBhwo4H2QbKNW51/MJKYvxHcVoFmCgj6u4214eY/wqZk8hHHeqqO8g+M3G5Vw93B7laT3y3uI03FeOmbt24CT4yN8Rj08v74l6XVBpoD0dDa+8fTNL/tUdxZq0QU2LMcV7YIbRQJzBOYIzKlTyzpbmpK/ndn/hh+mNoXAnHZVcPzGHxvD9HnbHB9l9kfTDucIzBGYIzCnseRuDH+eTNqG6TiBOe2y8Flaf99037KA7EDoY0JXlu7iKjnxabbX5e0LqMwxWpwWXySdzehl9ncMx8uLvyYhhBBCCCGEEEIIIYRwRtkW4Gp9QVFrigjMEZgjMEdgjsCc8t0LNC3//9su1yUwR2BO2xZQ1H98VwjM6UUXOO/6At/+AAk7Vdh21hK2AAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-female-crystal-mage",
    "name": "Crystal Mage",
    "category": "female",
    "description": "Crystal Mage: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB10lEQVR4nO3av0/CQBQH8O+93AQxcSiDri5dWIGNMJgwsBgTBxY3E2d3/wJcTdwYCIkkxoXNxISNMMrCgKvG2MFFRjVFLT+EFnMtFN77JKTX3vFCr+3dCz2FAO3226dffXpv4Pv9ZGpXIcYIzBGYIzBHYI7AHIE5AnMqaJ6PWi63rWJ9B6T3BjOTnXnH1w35VWazW17ZPdla7drbzmqzjrT/VRydXMLaQbF4goSF4RZ49ur8YnQfE4gz9f76tNAY4HYA8PGzRxg4ow7wE9QBsR8DflWvLjFwXoYft7wp9KINjw4P0Li59cpsOiCZ2vUek+kTH69bVyrsgM2mWYeUSsv9/4DAHIE5AnOqWn0wemYty5p5PJ1284aRbnexvCFsQWMKgTkdVWD3itv2913Q6wVf/U7nbmI/k9nHMhCYIzBHYE4j5grZaOMTmNNRBl9k9F817TgOwkyE6vWLP1PZ+BRXLp/NbT+u338YbgvZyfZhU5XKvVEmaNs24jwGBL2d1tMHWq3GxH4+f+Rbb9vnZr9QCCGEEEIIIYQQQgghlkiZBohqfcGy1hQRmCMwR2COwByBOb3p7/+DEJgjMKdNA5iuLwDMEiFTBOZ02AH/u77g9Hi16wu+AKF9ei3H8182AAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-female-nature-goddess",
    "name": "Nature Goddess",
    "category": "female",
    "description": "Nature Goddess: fantasy female imported from custom skin folder",
    "model": "slim",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3aO0vDUBQH8H8Ot0XEQTSKkyBW6eJihy6dXaogSMHRwcV+DDe/QF0cxEkKgmC7iGOHOtRFhIK6OIkGcRAROyiptvSZtKRJ2pzzg9L7OLn0Jr0PyNVgYzeX+LGqz8SPLa8Pz0Q0DDECcwTmCMwRmCMwR2COnCyBQaD53cmj9YKv+wTVa2Drhid9vYMgUHYB3XZ6tfJRvxHa9+tD1yEQ0mdRMV7+04uI5WMoJUvV72I82xbTid0N8nsIUK+BFeMRJ9MHuCte1TsfBGRV2fhkT88usBxZqH7MdKeYUaR6Ddze2qh33EwHheonOEgdr9EG3eBmJupoX3GeLns6KRKYIzBHYE5L7OuOxqyu653Ll8ab8sb9J/xgN6cQmFNuNWw+8bW9RDV9eViwjX++/WjKz61MwAsE5gjMEZhTGHLZVM7R9eF0xLKewJxys/FeZn+/KcNwtkFp3QeV80bbUta4xEWTetf4Ru9PX3+JFEbrHxBt6aBpcn6sr3gvqdaCt5tKU35qNWRZj6hLv0wIIYQQQgghhBBCCCFcoDltwK3zBV6dKSIwR2COwByBOQJzKujv/+0QmCMwp5w24PR8gd8IzKlBN9j3+QKf/QJyink/tbiAGgAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-male-dragon-knight",
    "name": "Dragon Knight",
    "category": "male",
    "description": "Dragon Knight: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB20lEQVR4nO3aMUvDQBQH8H8ep6KIhVIQFTK7iNA4iYuTDg6KizhbBP0EipOrU0EErThJt1BHwcHFtQ4uDm4BEaEIFVHUQUmwpa02SUnTNL73Wy65u7w24Zp7R0+Dh8W0/uXWfpDLuV4/asxp6GIE5gjMEZgjMEdgjsAcgTnNa54P29m1FWmeoPx0apbsbGQyiDvlp9NCZuvPeh3xp9xS2eFUEstLy9XzYrEIwzCqpc0smHgsPTWN0e2jRPnptL2+4pRXhRNkdzZhHu05daeH+4g75dWhMkIK55eYnpp0jm9u77A0P4vpKfeFUOwfwOPP0K4M4wszX22zj+2H4zb844DAnNbugGszwfKK46vO5gUE5gjMEZjTFidSgX6zqcRA07aRRJ9TPpTfERWvd4oK88OjvHG/VJjBc6uWU2by3qsG6+mt7lxP9qMTCMwRmCMwp9DldrPBFlzHxpxrO4E5FWZwP2//qKlS+RXtTISurfKvqax2ikvriab9a5VePhDLEZBuuEFbarC3pf6dpBor7p8/687Hhnpc28fD+mZCCCGEEEIIIYQQQggRAi1ogDD3F3RiTxGBOQJzBOYIzBGYU//9/38vBOYIzKmgAYLuL4gagTnV7oCt7i+I2jd1lXdyGtp+bgAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-male-dark-mage",
    "name": "Dark Mage",
    "category": "male",
    "description": "Dark Mage: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABwklEQVR4nO3avUrDUBQH8H8Od1ARQYkOIgVphQ5OLs3qEiffwdXJwcnFxRfQQVzrI4guzdI1BR+gg0UQJw2KItWtkkBLG2mSmiZpcs4PSm5zT2570twP6NUQQke1F1Rv2xeB11eMPQ0zjMAcgTkCcwTmCMwRmCMwp4XN80lz0M50naDCAsIWOoZxhMJ3gXLNxKnR9I7D5SLQHuzG2C6wpq/gxXnzkr3SWt65w15tUDbtj0HMf5+QrLsARQ10E1+v3+Pm+tIru68iUEGV/V+207JwazWxWdrAdnUL52cn2Dd3R2LyiqIGugk/Pj17N6KffBGoSYKLlHifNu0GqzBjrSvasFIdFAnMEZgjMKeVsBOrzy5AD6hb9o5dvCMrYWOKSvLDs0w8KpVk43U0vOMB9kJjv/A68n4Rq0gDgTkCcwTmFGbcnX0c6/qKYQXWE5hTSTYeZfTPmurCwTQXQg46f6ay4SlOR3ls/LAffCKXT4DuS9A1h6WJ4tOk/Ce+fXd+3vfl/fVCCCGEEEIIIYQQQgiRJ1rcBpLcX5DGniICcwTmCMwRmCMwp4r+/38YAnME5lTcBuLuL8gagTk17Qbztr/gF/6WazfreNyZAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-elven-warrior",
    "name": "Elven Warrior",
    "category": "male",
    "description": "Elven Warrior: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB1ElEQVR4nO3aMUvDQBQH8H8eZ0EQKqWKOIjQgvETdKmCDk4KBRdxcu3iN7CDLi6Kq9RBEEQEQdDJxcXvYIUO4iCioVgUBDtUEktpq01S0jRN3/tBuEvu5dK7JrmkPQ0OqsXrql15Jarb7h8ZS2roYwTmCMwRmCMwR2COwByBOc1pnPf9AySXtdCcAZWo7vjgEzbkttHmsri3YW2bO9odmM5Qdo0Yio8Dxmstn4Ce0etpXWIelVrMv3WUC+hn1ElwPrUP4AP5VB6DgtwGnhweWN+0uZj5QaF9vxVdjwJnF1dWura64voATpdA0KOA5tQB5utsuxi7stB0ALoss5329FxxmbvraYcQmCMwR2BOS2/qnq7ZeDzevmw6aqXGYxlBcbqnKD8PHmTD3VJ+Vr60tW6lNzunjrEvD6Wm9YmZGHqBwByBOQJzCn3uPHvsaf9ILmlbTmBO+Vm5m7t/0JRhGOjmg1Dh9unPUNY4xOkLU23jG70/f/5msgjXGaC3NNA0OjnSUXwvqdYNpfuvpvXY7LBtOcL/u6gQQgghhBBCCCGEEIIRzWsFfs4v6MWcIgJzBOYIzBGYIzCnBv3/fycE5gjMKa8VeJ1fEDQCc6rbFXY8vyBgPznhfulfk5a8AAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-holy-paladin",
    "name": "Holy Paladin",
    "category": "male",
    "description": "Holy Paladin: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB0UlEQVR4nO3av0vDQBQH8G8eN+lakSoUpBXi0KWgdhDETdBBBEU6VwdX/w0Xly4W6SD+BRXdROhQHQrFQYdOBS1iV7sq/YE01eYakjSx732gXNJ7eU2a5O5CzoBGrZz7squPxjZst5+eWzIQYgTmCMwRmCMwR2COwByBOUPXz/stkT4OdJygdAG6gU6jfgc2t8DlxaGlnATK7gxPzc6g9f7RXY6aODowgV7Z6sXEl/d/Yv7jFUJOgquNXVRLN0D8HJOC7Cr7z2whd4rF+ELn017+K+Y/Mj7fnrW9wLDLWNdA2m0bll6AdAF2j7Nhf9QdheF1wnIx62pckd7Oj/VPJTBHYI7AnFEs7Li6ZyORyNC6VDLaKStPDQRF16YoP388yAMflfIz+epWtlM+XOe1saXHumV9bSWGcSAwR2COwJxCyCVTJy4z2Lc/BOaUn8lHaf2DpprNJrwcCOWvKr+6sv4uLptJDY3v91Lr7teZNTz8V0B24ADbzETEUfw4qcEvbu9fLeub6/O29aZp+rVvQgghhBBCCCGEEEII4TnDbQI/5xeMY04RgTkCcwTmCMwRmFOT/v5fh8AcgTnlNoHb+QVBIzCnvE7odH7BXsbrPXDmG34kcPPkrjWrAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-viking-berserker",
    "name": "Viking Berserker",
    "category": "male",
    "description": "Viking Berserker: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB50lEQVR4nO3av0vDUBAH8G+ON6iIotZfSxx0KIhDcRChTqKToIudBV0666CCCA7qoGD/AFcHJwWniuAgiIM4iFChinTSWhVF1E1pRGirTVrSNI13Hyj58S7XvvDIu9CnwcLemP5p1t4zvWZ6fcdASEMFIzBHYI7AHIE5AnME5gjMaVbzvNNGdhKu1gmqkKB8xc75+gy8jsCcMitlW5oacDA/aezrwXGc9GroO/00tu2RbeP84PImkg9PeXNU+ihRhQQdn10Yn9bpDRxuRXA3sYibswvUwvuUVcDPCNndP0J/oNvYP7+8xuhQEAiYvwh5/gYkM4Z2usPpm/Cz/1eMF6ligjM7/l9opU44O+y3VVesRmNlrQsIzBGYIzCnTfXZexfw1dfkbdMbvtsST29wi9UzRTn55W52vFDKyeQreszYziX8lrHx+9es467m8tSZBOYIzBGYU6hw4YUlW9evRkOm7QTmlJPJC3n6u02lnu3N1bmF0NFV6tdUljnFBTt9eeMz3b58GNswPDYCgjkdTGurqyoqvpxU7on443vWcVdjtWm7X3fqpwkhhBBCCCGEEEIIIUTpaXYTOLm+oBxrigjMEZgjMEdgjsCc+u///1shMEdgTtlNYHd9gdsIzKlSJyx2fYHbvgA1lHaoTzhLCAAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-male-shadow-rogue",
    "name": "Shadow Rogue",
    "category": "male",
    "description": "Shadow Rogue: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB1ElEQVR4nO3asUsCURwH8O/9eJBdUlTX4NJikBItuSZR0CZCY9TY1BKtTf4H0l7g0hgubUFQtNrS0iJBEA5ZUdilU6GhpeTdyXme+vt9lnfP9/N5v1Pv/dCnwUbICH9ZjV9k05bPj8aTGvoYgTkCcwTmCMwRmCMwR2BOs1vnvVYo5n2tE5SToHbFztrGPgadcpL81l6q7digXwRlVcrOTE/i6fm10c/lcojFYo226vYq0xTTqt8vEHUSfHqcxsHudiP5YaCsBuvv7MlhCmfnl7Xjhfk5bCZWkVhfaYoZVOQ0sJrw/cNj7ULUkx8GqpPgYUq8Tuv2hJHwkqu64i5/09O6gMAcgTkCc9psKOLqO6vrevuxQLDWmuUS/GJ3T1FevrifiTulvJx8eXGn1l7fHtnGlj7emvrBsQn0AoE5AnME5hT6XDbz/28RTkXjSctxAnPKy8md3P39pkzTRDcLoeJLoXEc1H+WspL5u8QZU6G28X+VK+7Oy7dPgNGSYFUgoHcU30uq9YHPyntTf3Rk3HIcMLw5MyGEEEIIIYQQQgghhPCA5nYCL/cX9GJPEYE5AnME5gjMEZhTw/7/vx0CcwTmlNsJ3O4v8BuBOdXtCTvfX+Cvb9oTdmFKf8krAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-wizard-elder",
    "name": "Wizard Elder",
    "category": "male",
    "description": "Wizard Elder: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABwUlEQVR4nO3aPU/CQBgH8H+f3ORCQ9DgggtDF1xh4BvowOysg98APoE1cTEODsbEyZkP4YCrLgwusthoQ2Bz0/SiBDDtQUpf7PP8kqbHvcGFe3pHOAsGg8HTV1S5sxvd3t7bt5BjBOYIzBGYIzBHYI7AHIE5y7TOJ63VynafoEwV5jc6w7fwvEKHQKnWwGHvHs1mQ19BOsgrAmvyGh4CpZ1tTN8/9GBPrh913s1pc5a+ONia1QljmiG5D4FfwcDx6elLpwFMR8/472iVSsFAb6/O9TcdXDpdgMEbQ8A0jU2/BKPa5iUECMxZm+6w0+nG2lf0+26qM4LAHIE5AnNWu30cK2YrlUpEWU3ffX+ErJieKSrJN89y4KtSSXbe7Z7pu+v2jHU972XhdbVaRxoIzBGYIzCnkHN3l0ex2tt9N7KcwJxKsvNVnv5ZU77vY5MboeHw4c9SNr/EOU47tP68ycT7ScULgdRngLM0wIBtV9eqnya1nDEeL25IyuV6ZDngJPPJhBBCCCGEEEIIIYQQIgFW3A6SPF+QxpkiAnME5gjMEZgjMKeK/v+/CYE5AnMqbgdxzxdkjcCc2nSH658vyNY3+At/e67QdI0AAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-male-beast-tamer",
    "name": "Beast Tamer",
    "category": "male",
    "description": "Beast Tamer: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2UlEQVR4nO3aPUjDQBQH8H8etyiCohEUsTg4dFGwcx3URXQpuLkJLk4O7VBBHFyq0K6CH6A4uAkFwc3dqbOzIBWMoiC6qbRiTVvzIdc00fd+UO7Se3nptUnuUs6Ah+xi4t2tPZ3Nu+7fPz5tIMIIzBGYIzBHYI7AHIE5AnOG1zgftK2TUqjzBOUnyGmyU9jKgNUlsLq3UVf+B8ptKmv292EtvfRZH5tCcjZeK7/kCoew7u4dc0T9LCGvAPsXNPE2icuzY6zM7ze1/VXk1mj/ZXe31zE6Mlx9Veo/xfxFym/gwtwMTs8vavX/grwC7I+zlY7bOx/1R10/jFYnXE7pzSsOiu2dFxCYIzBHYM5IJWNa16xpmo5tg2ZXtSxbzwiL1z1FBXnwMDvulwoyeSqfqJbFTMkz9vr2qW47NtCNdiAwR2COwJxCxOU29Z44D4rTru0E5lSQyf3c/cOmLOtFK0HjPKh0VW4ayuxDXCI+6BhvZz3qfa7QzoBEQwcrzJ7OX8W3k2p84+bhtW57qLfDtf3730EhhBBCCCGEEEIIIYSIPkM3QZDrC9qxpojAHIE5AnME5gjMGWGPAvs7R1rH112uS2COwJzSTaC7viBsBOZUqxP+dn1B2D4A7VlwnIJ0jzEAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-male-necromancer",
    "name": "Necromancer",
    "category": "male",
    "description": "Necromancer: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABzUlEQVR4nO3aMUvDQBQH8H8e19YGoYNxDYJLFwMKYgW7CDqIH8iP4Owqjjo4iRYHBRcHCwULnbq4dG0cCpLadlASEdJKk0iapu17PwiX5F5euJLkLulpCKHrha+g+upTJfB4q1TWMMMIzBGYIzBHYI7AHIE5AnNaWD+fNMfppDpOUFGCxg12SvvHYHULWDfloXIRqKCh7KqxgnVr11vf2NkbKn+9NV7Qtt/H5pj1q0RFCaq91r3l1rjEXesKF/YZaqhjEVCUoO2tTbRtG2um6S3uurtvEWiN6nPkXuD+4dErjw4PIp8g7BZIuxegsAD/66zbcH/jZ/1VNwpt0glNsxhrXNFqNaf6oxKYIzBHYE4zDDPWPavr+ti6XO6nrtdzkJawZ4pK8uRpNjwqlWTy1knTK83TYmhst/sxtJ3PL2MaCMwRmCMwpzDjKtfnsY63SsHfLgjMqSSTR3n6p005Try+enQg1OnYf7oyfxdXKBhj4/36/U/M5RVQGGmgK5td+lf8NKnRHYNBd2g7k8kH1gshhBBCCCGEEEIIIcQ80eImSHJ+wTTmFBGYIzBHYI7AHIE5tej//4chMEdgTsVNEHd+QdoIzKlJJ5y3+QXfSDN0SroaNqkAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-male-sun-knight",
    "name": "Sun Knight",
    "category": "male",
    "description": "Sun Knight: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABxUlEQVR4nO3av0/CQBQH8G9fDgdidKkmLi5g0kFDUgcc/ANMcGVxZpE/wsE/Ahf/AGPiYMTExc1BBru4mIiLi4l2kRAHO2AEYgBDD9JflPc+y7Xc6+OaHnfXcAY0OnV0/Oq9YtP3+oWVvIEZRmCOwByBOQJzBOYIzBGYM3TzfOQN2Eei6wSlC9AtdDKNPNKMwJzye8IZcxVw3/vHOaCxDRQfuqWXO+8FlVrw+jFp7CFq0kDPfYHTPgJuL2EX+jc/B8ivcvDJnl1cdUu7sPl3PBqTRsb3R1M7C4zrxroB0u/aWZkFCMwZYSe8r9mB1hU7VSfWHkFgjsAcgTmjfmwF+s2aZnZsnb2x2C2d5zaSohtTVJRfnuSNT0pFmbx4aHfLxomjjb17/Bw6391aRhwIzBGYIzCnMOPscsA3z6r/uwiBORVl8klG/6Qp1/1CmAuh0+u3f1PZ4BRXKa2NjR/09NprV62MdPWAysgN/rLWs1PFx0mNfnDjtIbO9+wl33rLMqNqmxBCCCGEEEIIIYQQQoTOCJogyv0FcewpIjBHYI7AHIE5AnNq3v//1yEwR2BOBU0QdH9B0gjMqbATTru/4CDsBkzpB/i5b7R9Z4pEAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-frost-giant",
    "name": "Frost Giant",
    "category": "male",
    "description": "Frost Giant: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABx0lEQVR4nO3aPUjDQBQH8H8eNzkHcRAF7VAKOtilYOcOopClHQTBwcnZobNTB+fOzulS8GPo5KDQpYtCp9ZBHIpmE1yVFMS2mi/y1ea9H5Qjdy+vuSa5O+hp8HDdHXy5tetL7ueXtnMa5hiBOQJzBOYIzBGYIzBHYE7zmufjtl9Kd52g/AQ5LXasTyw85Sfo9Lj2b/1508SiI/vuOn3y68tTwb1eb6q02TFuOTI1CA5HHzBv7lAsFpEVyivAvovNSxOd2ytY72/jOqN2hMreAbJA6z76nwXsH8EWpPNeA+VCzAI/snLXJ2lRJ6xfmKHWFY2zWqJPBIE5AnME5rSTejPUO6vrumPb2mZhXL4M+0iL15ii4vzyNDvul4ozuWFUx2W73fKMHfR/l9e2XCGZ1SaBOQJzBOYU5pxR2Ql1fsOjncCcijO5n9E/bcqyLES5ELrvtP5MZZNTXLlSdYyfNHp9juQVSPwJKM900LayuhEoPklqtmLw9DB1nNvadW3P5/NxXZsQQgghhBBCCCGEEEJETgubIM79BUnsKSIwR2COwByBOQJzKuv//3shMEdgToVNEHZ/QdoIzKmoEwbdXwAcRn0JgXwD6LJn6b1LUbEAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-male-demon-lord",
    "name": "Demon Lord",
    "category": "male",
    "description": "Demon Lord: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABm0lEQVR4nO3av0vDQBQH8O89bhEEsXTu7Oxih4qbIHZwsf+Gm7i7ODjoqH9CMugQFzexg138I5xLRRAcT9I2JYT2ruWapMl7Hyi5y11fuST3o+0pOJwBxlZ+FQXW97e7PYUNRmCOwByBOQJzBOYIzBGYU655Pm/PQKnrBAJz5KoQr/SejMEJMD6m065VYBWojyhY2AWajV0MR984OD0H1PRJNWaWHkTBrM4iN91eTbqAMQgf7hA+3k8uQvyqAW0rTO7s4CXE61sfx0edcf768mKWtt39yl+AtLjB8UVI0nWhV6lcp4Yn1LoDdjzXFf2CB0UCcwTmCMypPc8+27SU7UyPPyiPa0zReX54mQ1fls4z+Pv+5Hj46a47yuQbKAaBOQJzBOY0Ntyt528ObcfXcQJzOs/gy4z+ZdNDzwDZhdDXnKksPcW1LPXTflHRJ6A159z2ivWLpLMn/jL5LUe5EEIIIYQQQgghhBBCVInyDZDn/oIi9hQRmCMwR2COwByBOV33//9dCMwRmNO+AXz3F5SNwJxed8Cq7S/4B2i4W+XRVcsYAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-forest-guardian",
    "name": "Forest Guardian",
    "category": "male",
    "description": "Forest Guardian: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB1UlEQVR4nO3av0sCYRgH8O89vRRRJNQ5RHAUNFxjBS3p/+DeUIP+BTY0tbT0DzTp4lBDQ7bVH1AQDrk6C1HUFRhhFERxiqKGdyfneerzfEDux/vco68+d/cevhpcJA7MX6f2zG7G8fjoWlzDECMwR2COwByBOQJzBOYIzGlu9/mgXR6XQh0nKLcAt4FOKpcCm1Ng82inbTkOlNMvrEcXYL281tfNGPSY3lw25PcvmjGjWCHKS9BtoQgUijhZTuPu6gyHM3u1fdtb6xh15CXI7ujTs4XVFaP2stfHofOuFdAo7UYZX+fOm232un36OJX/WFRA1OFxdtgfdb3Q+p0wljR8jStusuWBfqkE5gjMEZjTzETE1zmr65GubZHFqdqy8viFsLhdU1SQbx5mx71SQSY3k/Uhcylruca+lT/btueNaQwCgTkCcwTmFIZcPn3q6/hoNu7YTmBOBZncy9U/bKpqVf1l6BgIle8r/25lrbc4Y6N7fKsP6xsjWQFGRwdts/pkT/GDpDp3vD/8tG3PLU04tsMM6JMJIYQQQgghhBBCCCFEADS/CYKcXzCIOUUE5gjMEZgjMEdgTo37//9uCMwRmFN+E/ieXxAyAnOq3wl7nl8Qsj/IuHe1YXM8/wAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-male-sky-pirate",
    "name": "Sky Pirate",
    "category": "male",
    "description": "Sky Pirate: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2klEQVR4nO3aMUvDQBQH8H8e5yAISo1oFboahHbo0qXdFEQXBemgq34HN6GL+gUctI4OdrGLojiI6OLi5OAiSEFUjEWh4OCgNENJq01a0jRt3/std8m9u/ba5O5CToOLpBH5cSrP5Q4c64/HUho6GIE5AnME5gjMEZgjMEdgTnOb5/12fV8IdJ2gmq1Qu/BJp1fA5xaYXraS9O4xeoVyWsqOjgzj9e3dyoejSawd3yAcTcCY7QPwbZ2/vDitxPyn068QaiZ4qXSHs8N97M0n0CvIqdD+z+5sb1hpbGqykq+N6UbUaODi3AweHgs4Ojm38r2C3ALsj7Pljts73+mPuo3QWt3g6kLS07oim79u649KYI7AHIE5bSFpeLpndV2vWxbWB6302fxEUNzGFOXnhwfZ8UYpPxuPr19Z6e1WyjW28FKsOo6MhdAOBOYIzBGYU+hwmcymp/rZvPP4Q2BO+dl4I6N/0JRpmmjlQuj2vvBnKrNPcXEjUjfezvwooSuvgHhNB8v0oYGm4ttJ1Z54Kn5VHU+E+h3LDb++mRBCCCGEEEIIIYQQQvhA89qAn/sL2rGniMAcgTkCcwTmCMypXn//74bAHIE55bUBr/sLgkZgTrW6wWb3FwTtFw0ocjHfr0EeAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-male-arcane-scholar",
    "name": "Arcane Scholar",
    "category": "male",
    "description": "Arcane Scholar: fantasy male imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABsElEQVR4nO3avU7CUBQH8H9P7iRGCMGIDE4OdXBxcekjOMDCIIOTA2/g7KJvYIxzHbrQwUdgcXGV2UExIkGjjGrASKCUtqa00J7zS0hve08vOeF+JVwNPsrG3rdXvWmZnu9nSjsalhiBOQJzBOYIzBGYIzBHYE7zW+ejZjfvtKXuAaZlum52Zj1PGhU0MA3JutE+H+9nDoGVjXX0n19+y5s6Lo5vUb/aH16PTrNTMW5q1Vqyh8Cf/lML9ctt4Ot1lHwaUNBAq3Ez/KUHn0E5LZRX5XjXrlYORokPym4xqZ4EnYmnhTbvBstGOdS+wm7asU6KBOYIzBGY04xdI9SYLWQLvnWdtw4WxW9OUVF++SITD0pF2fjJYWN4Pb+u+Ma2u+2J+2K+iDgQmCMwR2BOYcmZ1lmo9zMl27OewJyKsvEgs/+iqbBrtXMj1HpoTS1l40ucvqXPjB/X++ghkT1AdyQ4kFvN/Ss+Tsr5oPvenbjPr+U964UQQgghhBBCCCGEECJJtLANRHm+II4zRQTmCMwRmCMwR2BOpf3/fz8E5gjMKQ5nAb0QmFPzbjBp5wt+ABs0fIBzGuqIAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-neutral-spirit-elemental",
    "name": "Spirit Elemental",
    "category": "neutral",
    "description": "Spirit Elemental: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABsklEQVR4nO3av0sDMRQH8G8e+RMOQQdBVHpLlw7qIIiDLio4OfQPEHRw0blDXSs4OaiDUwc7qkstgps6dGgXxbo4KMj9D5VeqbRqvSu5H/Xe+0BJehdek3DNS2kUPNw1mk0YmJtSCkOMwByBOQJzBOYIzBGYIzCnTPO8qbj3CQTmyG/Dvdzxr/VET4A10i5nJwF7fhOn5d56d5v/SvtteLIFlCpPKFVa9ZR77f4FyX4CnA98DXT/sIjxiZT7atU7g++0YZEFyhdFt1xeyyYmCyjuaVAFHfDo8s1oQrdXxyKdEAJzBOYIzKn8Wc3oO2tZVt970+lRt3yuvyMuXmuKDvPD4xy4XzrM4Bm7/QRUH70nov5w3fM+PbOEKBCYIzBHYE5jyHXWkbAQmNNhBvez+sdNO46DIDdCV8WDH6msO8WtZHf7tu/22qi5ZSZfQJjUTuHGaCdo2zaGeQ3w+rmtv1+o3p73dmBh48/7tp0z6qAQQgghhBBCCCGEEEJESZkGCPN8QRRnigjMEZgjMEdgjsCcTvr//14IzBGY06YBTM8XxI3AnA464KDnC7Lri0F3YSCfCzVrJvDCwKMAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-neutral-crystal-golem",
    "name": "Crystal Golem",
    "category": "neutral",
    "description": "Crystal Golem: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABwklEQVR4nO3aP0gCURwH8O/9eFMNLVLoEIQFt0TQkA1CU9FQYItDcwTO7Q7OBdFQS4NDNLQ05BAkQeBQDUG2OOiqFK65Fp5EV2J38u6P3e/3AXnPu8fPd4/z/d7pM+Cg3nz/gIbZxLiBEUZgjsAcgTkCcwTmCMwRmDN087yusNcJBObITaNkfAz5ozOrtNcjPwCTU98Xmc7s4uShv25v8x8ptw1zKaBceUa5AuTSC9axRgvRvgPeXjtW2Wh1cHhcxExyznp1691j9jYsssDV5YVVbm5lI5MFDO5p0PA6YOm+qTWgG8uJQAeEwByBOQJzRrFU1frOxmKxgefmF+NW+fIU3oLBaU5Rfn54mBfulvIzuGn27oBazXkgHis3P94vpVcRBAJzBOYIzCmMOHN6wtf4BOaUn8HdzP5hU+12G14uhM5PD/pSmT3Fbe/sDWxvV69VrbJQKMBPxn7xVmslaJqmd73xYQ5wetxWvw/cXfd+9Piysp7987xp5rU6KIQQQgghhBBCCCGEEEEydAP4ub8giD1FBOYIzBGYIzBHYE5F/f9/JwTmCMwp3QC6+wuAJMJEYE55HXDY/QWZtZTXXRjKJ4/Pb9CJ3lGRAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-neutral-ancient-automaton",
    "name": "Ancient Automaton",
    "category": "neutral",
    "description": "Ancient Automaton: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABw0lEQVR4nO3aPUjDQBQH8H8eNzmpZBApUrRgFVxc6lAQF5c6dNFVBxcXXUQ6CTopuDjr4Ozs5CJKhk4uiiIoiGjpENTJVWmKkrYkaciXzXu/5a694zXX3OUd5DR4ODs9+UYAC0srGv4xAnME5gjMEZgjMEdgjsCc5pXnG3ncqY9bW6/sE8irg9sAgw6+55aAcXXcUqaBcmscHOjH+8enVS8tLkPvM1AoNUvzq7NP6mdA9TaDw/0dFEpHSAtya7Tf2a2NNavMjWb/6u19Uj0DZoszeKvVcWlUrXpakJ801Ri4ffBJp7AwaGEHPNitBEqNm9t7sf6pBOYIzBGY0yrrq4HWrK7rjm1j2RGrfHp+QVK8nikqyh9PcuDdUlEGL06bVmlcO8+SX3cPjy2fJ8dziAOBOQJzBOYU/rl8Ph9pfAJzKsrg3Tz9k6ZMs5mqwtoInV8YHanMnuLm54qO/e1ea/VYloAKO2D7ABsyw0O++sdJtX9xc9+6IZmayLm2R32HhBBCCCGEEEIIIYQQIkxa0ABRni+I40wRgTkCcwTmCMwRmFNJX0DSr9YIzBGYU0EDBD1fkDQCcyrsgH7PF5TLYV+BPz8pBHZkdGPPUgAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-neutral-forest-spirit",
    "name": "Forest Spirit",
    "category": "neutral",
    "description": "Forest Spirit: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABrElEQVR4nO3bMWvCQBQH8H8eNxZLIR1KS4Z2EZdCQqHQ3VkK9hM4ubr4BQr9BE7OHfQbuBcKJY5udhBKhwZKS/eWKIqxagyX5NT3fst5ucfTO3K5Q08LMVrPzV9oqF8/WNhiBOYIzBGYIzBHYI7AHIE5S3ed12V6n0BgTm0S1K73ll6vtcrYdbSu8dA+iNR934+Uy2J2DSUJfhzeo9G5hed5YDEFvoKf2a3+0hvM6peVM1yVS5GYvX4GhMIOh4Mwfb0vKMkyFXZ8vvOml7A0WGknrHXKWvuK9l0v10ElMEdgjsCcVWm5WnPWtu2VbSelo3H5PviEKXHPFJXlm5vs+KZUlsndqjMu+91RbOzI/4jUHe8YeSAwR2COwJzClnMdVzPD8u8ypgjMqSyTb/L0N00FQYA0N0L97vDfUja/xLnVi5Xx84LX70l8Q3cK5HwHuAsdDNnnhUTxeVKLF96eJiM/dXpTWNteLGb10YQQQgghhBBCCCGEECJ9lm6CLM8X5HGmiMAcgTkCcwTmCMypff/9Pw6BOQJzSjeB7vkC0wjMqbQTJj1fAMP/u/oD7KNkz8b/3WcAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-neutral-shadow-wraith",
    "name": "Shadow Wraith",
    "category": "neutral",
    "description": "Shadow Wraith: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABeklEQVR4nO3azU7CQBAH8H+HKcJqJDE998zZh/BxeBgPPozvoFe5yrkx0WhRitG0xKYgbSHbD9qZX9LsLjuZZpKy28A6KDH1r39gYb54dHDCCMIRhCMIRxCOIBxBOIJwju0+b6vt9wSCcAThqGiSB27af3p+wGxxl7b7Ynq3BvDAxfo7Sser6DNph+4oN6ZXa8A6U9jbx0tSeHzF/X0xXcSHBl6eX6WFx/2+4GOC+1T4H6fqhL43tXqvWATzRtcEgnAE4QjCOZ7xrb6zxpjcuTN3M/cVhWhL2ZrCdd68zcIPxXUmvwlmSXvv3ZbGLlfvW+Px8AJNIAhHEI4gHOPEFe0yVSAIx3UmP2T1bxuHYVjpI/oaBv+2suwWNzFebnzWar358cUYH516AiY7BcaGPDoqvkm8+0GE5dbYxbhwXimllFJKKaWUUkoppbrEsU1Q5/mCJs4UEYQjCEcQjiAcQTju+///ZQjCEYRj2wS25wvaRhCOq07YtfMFv5RWYRKX4Yq1AAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-neutral-crystal-fairy",
    "name": "Crystal Fairy",
    "category": "neutral",
    "description": "Crystal Fairy: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABsUlEQVR4nO3av0sDMRQH8G8e0aEOdbilDi5Xsf9BFyfByUmQDq7uLk4OClYQFxEchYJThyK46CR01kHB4lJoV106VFAHHSp3RdpT22vJ/Sj33geOJJeQpmmTd6VR8NF+73RgYHZGKUwwAnME5gjMEZgjMEdgjsCcMo3zpuJ+TiAwR6M2PDo5+zef6CWQTgGvH930rtm9l7d7+Vym1ybxSyBvA/qtjvvHupt3riSgYZU/n6yTls7LyC4supeT769jEwUuKmU3XS9sBDaAuJeA4h4GVdAdNp4/jSY0Ozcd6YQQmCMwR2BO3dbaRmvWslID6+zMlJs2X74QF789RYf54nG+8VHpMDsf5xtQvbn2lJdXVhEFAnME5gjMaUw4K93dR8JCYE6DexhstVpGHVjWvKd8enzwJ5T1h7it7d2B7fs91R7ctFgsIkzqqtowehLM5bwTMGl7gN/Pbf37xmWl5CmvFTaH1u/s7RsNUAghhBBCCCGEEEIIIaKkTDsI83xBFGeKCMwRmCMwR2COwJxO+v//fgjMEZjTph2Yni+AnUacCMzpoDsc93zBUv4w6CGM5RvkUnEj2xiUxAAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-neutral-stone-guardian",
    "name": "Stone Guardian",
    "category": "neutral",
    "description": "Stone Guardian: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvUlEQVR4nO3azUpCQRQH8P89zLpaWBmKGBjcrZLkQt+hthEUYQtbBFGLWrZrUZsWtahFPUEPoYsi0AdIKATJykX1AoU3bviBX8z9MM/5gdwZ53C8o3NnBhwDfVyfn3xDw8b2voERRmCOwByBOQJzBOYIzBGYM3TXeV1+7xMIzKlBgtZze8jEF5AvPVp1u3xzcYr/jno1Tk1O/JXNaBBbK5mOcnPMf0SDBl7e5hE2F3F0uGuVG6+xfwQ+Pr+sa2Oo3z2UEJydRjQSRm5zDalkvCVm7EdAKhlH7fXd+iLszrOZBG3j1HGb4XTCg52s1r7i+OzK030BgTkCcwTmjOzqstYzGwgEurZFQnPWtVJ9gV/6zSnKzQ/3s+ODUm4mTyd+R0ehWO8bW36qtNRj8xF4gcAcgTkCcwojzjRNV/MTmFNuJh9k9vebqtf1brJ9I1S4L3YsZc1LXHop0TW+We2t7skjoJxO2N7BhuBMYKh4L6n2N8rP1ZZ6LBrq2e72LySEEEIIIYQQQgghhBBOMnQTuHm+wIszRQTmCMwRmCMwR2BO+X0Dfv+1RmCOwJzSTaB7vsBvBOaU0wmHPV/gtx9UuWlX6FBsogAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-neutral-flame-elemental",
    "name": "Flame Elemental",
    "category": "neutral",
    "description": "Flame Elemental: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABsElEQVR4nO3aIU/DQBQH8P+9HGYhwdRgMIRkBlMDGoEBvsA0IQExBBPIBTQWEja9LwAYPgGGGSSZwWBqSMgMomTpUjqy9tpcu65972fubvdy2zXbvWt3Cgb+y7EPC2q3r7DECMwRmCMwR2COwByBOQJzypTnJ3k8Liapryr7BDIFJE3QdvKV+wncd/ozZR1QYq/T+Kvv9HDSjJTzYmq/CF62gdE50Kv8Nz/lBfDGYXVwvRe0vXFQnxNTRTptYGt/E4PnUVivC8qSpiYTj06+7BSWB5X3gP6ta7cvOBsu9KISmCMwR2BO+VcbdkndceL7tlaD8v0bZTGtKbrQdy9x4mnpQkc/HQblnWsMfXj7mmkfba9hEQjMEZgjMKex7Fzz+pFsug7FIDCnCx09xepfNg3PQ54boe7TZ1g/nKayx0iK6x6sx8ZHvX4Ezxm6BV9D5bcbdjvBZvT52PKtAaZbdv3/hZvhz0z7wl1J7i94/kIIIYQQQgghhBBCCJEnZTtAoecLFnCmiMAcgTkCcwTmCMzpuv//b0JgjsCcth7B9nxByQjM6bwHzHy+oJX3J8jmF0r1aYVIJEGAAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-neutral-frost-spirit",
    "name": "Frost Spirit",
    "category": "neutral",
    "description": "Frost Spirit: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABtklEQVR4nO3av0sDMRQH8O89AoJLHQ5Bh4LYIYtLB+1QcLIU1E0cnMXRRQcXXVwVuqvQSfDHZgdREQSHItShLh06K8gN+hcoPaG02vZacj/qvfeBklwTXtPHNcnRWPBQrn98wUAmNWZhiBGYIzBHYI7AHIE5AnME5izTdd5U1PsEAnM0SOftwllbGfsE2OOJZn1uOgGd32iWnfrE/g7IjVRwcVfB0SJig3o1Ou+fzfp+4QTJqZT7atQ79Yn9KnBzdemWueWV2KwCllcCGgPs1qdX279JAHxWKr8aJWQpMxlqQgjMEZgjMGcVS1Wj36xt213bZtITbvny/IaoeM0pKsgPj/KL90sFGVzrnzugVvNOxNPjbdv1bHYBYSAwR2COwJzCkLPt0UDjE5hTQQbvZ/aPmnIcB35uhE6PD/8sZa1L3Nr6Vtf+req1qltu7uwiSNZB8d5oJ6i1xjDPAV6P2+r3Gw/X523X8/nVnu1a7xkNUAghhBBCCCGEEEIIIcJkmQYI8nxBGGeKCMwRmCMwR2COwJyK+///XgjMEZhTpgFMzxcASUSJwJzyO+Cg5wuy2bTfQxjIN4OEa3AVVD9BAAAAAElFTkSuQmCC"
  },
  {
    "id": "fantasy-neutral-wind-djinn",
    "name": "Wind Djinn",
    "category": "neutral",
    "description": "Wind Djinn: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqUlEQVR4nO3ar0/DQBQH8O+9nAKBaSBMYEDUYFgCCAgKghgJmAo0/wEeMUcCAk/IFGIGQQUJhIQwQUhGwmYQ08PUoiHbQrKxH11zvXblvY+5tXd5u7ts767bKYRoNL++YWApN60wwQjMEZgjMEdgjsAcgTkCc8p0nTeV9j6BwJwep5FX2Bx4v+w/I+toVOXs3FTPdbVa7SkHtckaitL4ofKO04sr5PN5sEuCtzdl7B14fa+zngRVlFWgNfCWuAafuQmwIfUJQMz8l6bRhBbWc4lOCIE5AnME5lTJrxl9Zx3HGVq3vDLfLutvn0hLWE7RNt88zYGPS9sM7jidT0AQhE/Ea+W+53p1YxtJIDBHYI7AnMaEcxdmrMYnMKdtBh8n+6dNB0GAODdC15fnfUtZ9xJ3eHQ8tH23xketXRaLRdikzkqPRjtB13Xj642FHBD2uK3/3ni66/zo8Wtr1xtZ77onRh0UQgghhBBCCCGEEEKIJCnTADbPFyRxpojAHIE5AnME5gjM6f/+/38YAnME5rRpANPzBcAi0kRgTscdMOr5gv2dtbi7EMkPG+Vm1hNwedwAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-neutral-earth-titan",
    "name": "Earth Titan",
    "category": "neutral",
    "description": "Earth Titan: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABu0lEQVR4nO3av0vDQBQH8G8etwpSghYrpWCHILY4SYdCty46uLi46ODSXaSLgrp0cNBZB11c7aCLm9DBxcWCU12KhSqhCP4BSgOFttpfXH5I3vtAuUvv8ZpLL7mDnIERbi+PvqFhbfvAwD9GYI7AHIE5AnME5gjMEZgzdOd5XUGvEwjM0biBpdOLP+uhvgCR6SmnXN3ah5UwUS6Xe+rdMaEfAec3T1haXsHZYcGptz9hoIY1tj6/nPLu6hgPj8+IRU0kE3PYK2wgl0n3xIR+BOQyaTSatnMhOp0P/QjoF6aOdxhuJzwpbmqtK3ZL176uCwjMEZgjMGcUd/Ja96xpmgPbFuIzTvla/0BQRj1TlJc/HmTHx6W8TJ7Nxp2yUqmPjH2pNXqOF5Mx+IHAHIE5AnMK/5xlWZ7mJzCnvEw+ztM/aMq2bbi5ELqvVH9NZd1TXD6bGhjf7a3Z8uUWUG4n7O9g23w0MlG8n1T/F9Xae89xKjk7tN3rf0gIIYQQQgghhBBCCCHcZOgm8HJ/gR97igjMEZgjMEdgjsCcCvoEgn61RmCOwJzSTaC7vyBoBOaU2wkn3V+w7vYJTOgH9o9o5+z31n4AAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-neutral-shadow-cat",
    "name": "Shadow Cat",
    "category": "neutral",
    "description": "Shadow Cat: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpUlEQVR4nO3av0/CQBQH8G9fDpSGQELKYExIjEsdXHDQQSYSZyf/BEcT/xX/DP8NGXSQxUFmFweNCYQUBROINSUFAi25/oC+91nujnt59Jrj7hLOQIC6fT6GhnanZWCDEZgjMEdgjsAcgTkCcwTmDN19Xlfa5wQCcxQm6Pn1ARe3Lbf01zP/AnIqP61fXgNPMBbq/phtpMIGnmKMs+MmgCYeX7xlo4Ftp1Z1jn6Hbnly1MBX7wOVUtVtH+zb07oXk/kZUClV3Zfg1bNCrROcpYF7jKgT2rW61rmi89ZO9FxAYI7AHIE5o2bZWr9Z0zSX9+0U3dL56SMtQWuKivPL0xx4WCrO5Df3bbe8u6oHxvYH3Zl2sVBGEgjMEZgjMKew4VbtMlEgMKfiTB5m9U+bchwn0in62X1f2Mr8W5xV3lsa7/c9/H+umnmIrZoB1twA/+zmzbXik6TmPxiMejPtQq60sh+w4nkyIYQQQgghhBBCCCGEiIGhmyDO+wVJ3CkiMEdgjsAcgTkCcyrr//8HITBHYE7pJtC9X5A2AnMq6oTr3y9I1wQbiWIUro+5jQAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-neutral-light-orb",
    "name": "Light Orb",
    "category": "neutral",
    "description": "Light Orb: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABuElEQVR4nO3av0vDQBQH8O89TocudSiIDi4FdXZycJYOOrhIcXFQ/AccdKydRHB18AcIQnFzsEP/gA4uiotgoXNBcLCLiA6R/qCm0iQtl2vavPeBcpfe8Zoc6b1LewoBnO+aAwNqclZhhBGYIzBHYI7AHIE5AnME5lRQnm/kca8+fm3jsk6goA5+F2h68WP3FTg/2ewq44B8WyemXfUZ7GUX/8pefeJ+B1S+tlF5KQPpC8QF+bb+vHWqhZszLMynm69GvVefcaQGmcgKt3fNciu7Ed4JRJwFFPc0qMIO6Hw8mA3I1PJQB4TAHIE5AnPKqRXNlrOJlHdbcqlV1p8QlaA5RVv99AgvvF/aavRkewDq7TvBx32p3HW8nlnBMBCYIzBHYE5j1CXmrIYnMKetRu9j9o+axuc7wlwI5Y4vO/W1diorulJc7nDXs7/b4/Nrqz2fh03KqV6brQRTrp/HRnAOCHrc1v/fOL0qdR3v72T82w8sD4AQQgghhBBCCCGEEEKESJkGsLq/YAh7igjMEZgjMEdgjsCcjvv//0EIzBGY08YRTPcXRIzAnA474MD7C45Wwz6FgfwCXYpz2qRUh+oAAAAASUVORK5CYII="
  },
  {
    "id": "fantasy-neutral-void-walker",
    "name": "Void Walker",
    "category": "neutral",
    "description": "Void Walker: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpUlEQVR4nO3aXU7CQBAH8P9Od2ktURPDiz7oMTyDiS/ewUsYD+BxPIfHwAd9kJgYAwFLW0NJoKBlaZaywMwvIbt0J9NdyvYjXQWLTnyZw0Fv8KqwwwjMEZgjMEdgjsAcgTkCc8r1Ou/K930CgTmqE3w/eFwoD34KkAqQ5WlR/+h38aKA6xxFeRtf/YnZxymg6wTfRBfAEfCZvwFtHP4UyEpH9iTsICBTfCb1/2L2kV43MNRtjMb9WZ3NSbBXmqOTgZcH73v+boLadMJTc+50X/GVvG/1RyUwR2COwJyK0XGas8aYyrZAtYoyzX/gi+2copvcuc+Br0s3mfwpeS7KB3NnjU2y4cJ3QxG2gcAcgTkCcxo7btVVZi3J6mYCc6rJ+4A6qq4CrvltD2w6sf1HLAwWOzhMv+fJVViU43w02xYFx5XxZWk67ZcxZ9irc0C0NMDpTlq14rdJL29IMT9aEwHCle1A3EzPhBBCCCGEEEIIIYQQogHKNYHv9wqua4oIzBGYIzBHYI7AnD709/82BOYIzGnXBK7rC3wjMKc3nbD++gK/fgHpr2ezO+1NigAAAABJRU5ErkJggg=="
  },
  {
    "id": "fantasy-neutral-nature-sprite",
    "name": "Nature Sprite",
    "category": "neutral",
    "description": "Nature Sprite: fantasy neutral imported from custom skin folder",
    "model": "classic",
    "style": "fantasy",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABoklEQVR4nO3az0sCQRQH8O8+5uxBFiGSLnoYog7tpQ5CNwkq8I/wP8iDp/4CT539L/IQ3QIPdbFDER6MIJSgxEP/QOGGi1q6LrM/bN/7XGbGeTx3UN8MOBZ8tHqNLxg4KdYsrDECcwTmCMwRmCMwR2COwJxlus+bSvqcQGCOwBwtm8zmMl7/uHCG8+6F1/4Vk7oakM1lMHr/9Ma9x77bFnfyC2NSVQNGUwu7ubz3Fj/pz8ekugYcnu5h8PLhLn7cTwsVJDhNC5+wwk7YuK0anStqB81YawKBOQJzBOaseqti9Ju1bXvhXMHZcNvnzhuS4ldTVJRvnuTCV6WiTF7ad9y2fdfxjX1qv86Mt0tbiAOBOQJzBOYU1py2daT5CcypKJOvUv2TpobDIcI8CF03O7+2suktrlx1FsZP63d/nkvX9f/6BpTnFjiW13ag+Dip+RcergYz492jzaXzWkf7CQkhhBBCCCGEEEIIIUSYLNMEUd4viONOEYE5AnME5gjMEZhTaf//3w+BOQJzyjSB6f2CpBGYU2EnDHq/oFIK+wmC+QZA9WcXFCcCUQAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-female-cotton-candy-girl",
    "name": "Cotton Candy Girl",
    "category": "female",
    "description": "Cotton Candy Girl: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB3ElEQVR4nO3brU8CYRwH8O/z25MslNNNAwZmoBgsyDRgMIkj2DRYLM7Nwj9gM5EtFoubbgYGBmcxsKlBgslg0QAMKRSL4Zyc423cHXgcnPx+n/S87RnP++3uQcGFmX82HQvEQo7ZanpeIcAIzBGYIzBHYI7AHIE5AnPK9Zz3+wckF1WwZ0As1Pthxy79nyHH3I2FZnCncN9sdCPco8x/pMyPN/slYMwAtSpghHHyaCXtx9AKR95bZew81gO9BLRj7m/D7rIXiAJIpFKNeLSStfIjcefGT8opkFiJo1SpWo2tVRvhn7RJoByXQJfzK2vkt7esmdCXgC8BNUgH/EnQOwBDZj6UPHWoWp4baYcQmCMwR2BOmTev3jbB0FTv9KXZznixjHFw21MIzGnfai6WcW1Ys2Cj5j76ucJtR3xzdR2jQGCOwByBOY2gi3z5Wj2BOe1n5f3s/uOmUf/EMB+Ejk4zzXDy9yjLtx1xR3tp2/Ltnl6erfzjQ/hJmZce3wqHDQR5D3D7Oq27EzK5s454enPXOf+gc0SFEEIIIYQQQgghhBAiyJTXCny7XzCiO0UE5gjMEZgjMEdgTk/69383BOYIzGnPNXi9X4Dx/u+IwJwedoUD3y9Y8/cGiJtvyTB68M+0VVwAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-female-lavender-dreamer",
    "name": "Lavender Dreamer",
    "category": "female",
    "description": "Lavender Dreamer: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB5ElEQVR4nO3bzysEYRgH8O88vUVb2stSSoQSOa65iCJSDkQONnJxIyV/hZOk3FxIah1E3DYiymXNSeLiwEVxktraE83GZBYzu83O7pjn+Vzm/fHsU+87OzNvO+9qcHGxZrw79esTNY6fr25o0xBgBOYIzBGYIzBHYI7AHHl5BIaBVulB9i7GK7pOUIUG5i940ntvCANVyMC7RxPA1s++y8Pkv58I5bSUraqrRfb5xaobhoF4PG4dTT1zLbaYfEGfICom+Po8hc3VZWvwob8Esp9n1vyq7x4coa21OVdfnJ3G5NiILea/UoUGmgM2J+GrHBaqmOAwDfyLVuqEt/sPntYVHeNNZV0XEJgjMEdgTjN2bj1ds5FI5Nf29s5GW/3u5hGV4HZPITCn/EpsnvFofTRXfn16dY0/TR/b6v36IMqBwByBOQJzCgHXrGd9zU9gTvmZvJC7f6WpTCaDUi6E1pOrVrmvayB3PLs6sdoWEkt/xn93c3+dO67o8/CTdrHh7VfhWCyGIN8D3N5Oq/yGZGrbVk8MzTj2L0zZz6gQQgghhBBCCCGEEEIEmeY1gV/7C8q1p4jAHIE5AnME5gjMqbC//3dDYI7AnPKawOv+AsD5z9d+IzCnSp2w2P0F+rC/O0DcfACeyXonKbDoIwAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-female-mint-chocolate",
    "name": "Mint Chocolate",
    "category": "female",
    "description": "Mint Chocolate: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB5klEQVR4nO3av0vDQBQH8G8eNxV0kOKiFESEOlScraKDoKhQF50EQSc7Obno5KTgqg6Cf4AOKvgDQYRaK04iFvyBW3DSTaFrpUVLI22uck1/vfeBcne5l0fa9JILOQsa/cFA2q3/9OLcdf/m9m4LNYzAHIE5AnME5gjMEZgjMGfp7vNeu362qzpPUKUEFZvsjA2PoKGHQPzhztEeW1t3lIVi6o3STWV/NbUFERwdypX53HLU+r+E3Dq/3j8c7YWmVtxdnWFnfLZoTMPdBU5/zu7u5ga6Ojuyn0w9v6+eqVIDpyYnsH94nKs3CqULyDzOfr49pQt98fy+emWVO+HWQ9zoB4n2DFR0XkBgjsAcgTlr4/bcaMz6fL6C27tCvY72a/Ie1aC7phCYU14lzpzxQCCQrdu2rY1PxhKOdmgwjEogMEdgjsCcQo2bafEb7R/V9BOYU14mL+XqX20qlUqhnBOhk+3dXD002Jctk7Gb3Lbxhbmi8fnsx5dsObO8BC9Zq5cHRjNBv99sjHp9DdC9nVZ/NyT2jhzt8HTEtT8SnTc6QCGEEEIIIYQQQgghhKgkyzSBV+sLKrWmiMAcgTkCcwTmCMypRn//r0NgjsCcMk1gur6g2gjMqXIn/O/6gsWVYLkP4V++AYbSd1gSFMKMAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-female-peach-blossom",
    "name": "Peach Blossom",
    "category": "female",
    "description": "Peach Blossom: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB4UlEQVR4nO3avy+DQRgH8O89uelladPYSRiaSASDiIFO4lciEYPFgo3FxCBYTAaxYe4gEgmdaxExqHQhQuIPMLDQ9ZVWtd6G9ypv37d9+zyf5e7eu/fp9f1xd8l7CgYf6WPbrd7q6Xc9X0U7FBoYgTkCcwTmCMwRmCMwR2BOmeZ5v7UkZuu6TtCmBqaFTi57AzavwMHGtiNtBtr1DkfagLeXYr4dS6PD5bTIGhkrtwnhE0JVtbq6X8snGSuCzMUZMD5fOhZ25Fr7fWcH4zvJw71Ctq+nG4X8YHzH0SaklP36XPUskDw5K6RzM1NV/4DpFWj4WUBFO0oXqfKP/6wLK1XrgPbjtacLoroGAn0iCMwRmCMwp+xs2tsgZlm/H+/sdZafblEPpjGFwJz2LXL+jrcWn473nLH5efrSUZ5MDCEIBOYIzBGY02h0sTZfwxOY075Gr2L0rzeNnMdOViyENvePSvmJka+pLHVRnuI2lxf+bP9T5u7hq35rHX5S9lXK20owFqtZZ/wYA0xfp3Xlgd3kqaO8OjftXr+y6KmDQgghhBBCCCGEEEIIESTlNYBv+wsC2lNEYI7AHIE5AnME5nSzf/83ITBHYE57juB1f0GdEZjTtQ747/0F2/Fad+FfPgHozHOcn1eUXAAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-female-sky-blue-angel",
    "name": "Sky Blue Angel",
    "category": "female",
    "description": "Sky Blue Angel: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABzUlEQVR4nO3aPUjDQBQH8P89T4eCTrGzoEMXxcHZroU6CEVB6NBFRBFxcnNyEhxFBRc3QREcLDgJbk4iCtJBwVk7+IEd/KCSijb9MGm9pl/v/aAkuWsed5fk5SCn4OHoJpt1q48E067n655ehSZGYI7AHIE5AnME5gjMEZhTXu95v40NKNUyd0AkmPac+LQa7VYZ7Qc+X0o77ByEjm4LyVu0LO1+Ra2Cjk4nge0octut0fx5bjGO7/MxmpH6eH6oOAfYg2Ard1f8dwBaJgfs7h/kOm7/7H0WOcBpaiL223F7n90AtFvHf6haB9y5fDOaVySGuuqaEwjMEZgjMKc2zl6NntlAoLNseWiwsDx19Y5G8MopBOa0X4HtKx6yvu+CVNr76l+cJguOh8NR1AOBOQJzBOY0mly878no/IRHPYE57WfwSrJ/o+lMxqyRxROhw82VkleZ8xU3Prv85/+d7q7Pc9v46gL8pNZOHo1mgpYVQDPnAK+v07q44HRvveA4PDnvWh+bWzJqoBBCCCGEEEIIIYQQQtSTMg3g1/qCeq0pIjBHYI7AHIE5AnO63b//eyEwR2BOmwYwXV/QaATmdK0DVru+YHFkptZNqMoX6s50IYCJ3coAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-female-lemon-drop",
    "name": "Lemon Drop",
    "category": "female",
    "description": "Lemon Drop: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3aPUgDMRQH8H+eEQsObsWiuAg6CK7qUjpZhAqCgyK46SwiCG4dXUTcxI6CoCgI7aIu4qRDF1dXserWQVBRT/qB/cBebO+uPfveD8rlkscj5Jpc4KJgYL3sWLYBHbO2zSrQr+BjBOYIzBGYIzBHYI7AHIE5ZXzPe92B7pWW7hO0McKw0cHnCVhMgb3d+V/L/52yXu9rT4GuIPD2DHT1AdnlQl1PolQOxEsxDf5D/D8FAFxeHAOIItQbBHCFzGM0Xx8J498j29bik42EJ/CQecLw0GD+lyvn6spj2nMKVDk4PM1fF+Zm8Gc+nwKqngFoiN8HAC6zrDNHA6pUtKkDQmCOwByBOWV9HDlbBDt6ajSMVt3fohVMawqBOe1d6twTDxXLGWN0MnldcT89PY5mIDBHYI7AnIbfvY14mp7AnPY2vXn1bzWNryzc3AjF4/s/5VhsLH9NpW7K2hdrxpdLp+8K7Rub8JKy3hPOdoKdA/DzGmD6Oq2rK7a2zyvu11Yn7dvXlxx1UAghhBBCCCGEEEIIIZpJOU3g3fmC5pwpIjBHYI7AHIE5AnO63b//mxCYIzCnHWdwer6gxQjMabcT1n2+YGXK7S7U5Rv2rHGx1HTrkwAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-female-cotton-field",
    "name": "Cotton Field",
    "category": "female",
    "description": "Cotton Field: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvElEQVR4nO3aQU7CQBQG4H8ebUnQI7j0BG64ARtga4x3ICEmSoiJ6QkMpzDGLfQQLF248A5uNaStqaEKoQid4rS08t636UxnOpl5mZmWMAoavu9HaeU2gtTnlXOkUGEE5gjMEZgjMEdgjsAcgTmle88XzXGcUr8TrCyVtn3sBLBx0EvAtn8GaDfQuxvE10R6tc4/pSL/ffsSsBsIgiAepDf14lvtZnuZbp21vgMQfGxtQjdLyl4ClFq6GJjnDecDPz0+wevLcxyE9huGiToHOQNWPDw+4fLi/Fdap+ozQGUNwGLgc1kHf3AB+IvKBwA5i6LIKKBKqb0GhMAcgTkCcyqMQqM1W0MNVabbUwjMWUU2PsU0vjbR1NYdj8eJfLfbxT4QmCMwR2DOQtUV/GuTwJxVZONZdv+yqVk4M/oQqtfqibzrust0p9OJr5PJZGP5pvw69/bGpHvaP2dV3gGo2h6gC4C1fmN0P0rk+1f91PLB9cCog0IIIYQQQgghhBBCCLFPyrSBss8XmJ4pIjBHYI7AHIE5AnNW2R0o+7Q5gTkCc5ZpA+FnaPR82ccsCcxZeTe48/mCfi/vLuzkC8UsebHv1LDXAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-female-berry-smoothie",
    "name": "Berry Smoothie",
    "category": "female",
    "description": "Berry Smoothie: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2UlEQVR4nO3aTygEURwH8O/79U5KSwmlFFeJWIc9ELkJRZIknHDnwE0uLhyUEkdpk0ThQrlwZNwkB5QTcsDBdbR/2t3Z7Mxus7P/fr/P5b037ze/ZnZ233vbPAUHX2sHpl2/b8Jve76qbVQoYATmCMwRmCMwR2COwByBOeU0z3utYmE0r+sEnU5QqsXO994tSv4n4Eu4+Z3pFUvptAosBtr2JmqqgfePaL0BM63d8TLKN98XjynCbwllEmz0VMK4OAFWp1AqyLY34ckGtzbCZXtLc6yeHFOMKN3A8eFBPD69IHh0Eq6XCu0UEPo7a749h6fK5BtP7CtWKtsJzWPD1Qeihtpzui4gMEdgjsCcMnev3Q1i5WX/H29qs7bv75APTmMKgTntWebQE6+vitRfPx3DT2+uLO2Bji7kAoE5AnME5jQKXaDS0/QE5rSn2dMY/fNN4+cX2VwILe9vx+r9/s5weXZ7He8fm00Zn8h4eoj0BxbhJWVunrtbCdZF5/oCHQOc3k7r5APrl4eW9nzviH3/5JyrCxRCCCGEEEIIIYQQQohcUm4TeLa/IEd7igjMEZgjMEdgjsCcLvX3/04IzBGY064zuN1fkGcE5nS2E2a8v2BkKduXkJE/BIFrtptDFWUAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-female-cherry-blossom",
    "name": "Cherry Blossom",
    "category": "female",
    "description": "Cherry Blossom: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABz0lEQVR4nO3aPUjDQBQH8P89bqpFlw466+RoFwcHrYuIIgh16NxBEFy6OXV00cHZuYMFRRRxkOrg0CUOIuKguwUXLXaN9MOS1DZXSdOmfe+3JHfv9cEl4XIlp2DwfVKwveKRlVnP36vxSYUQIzBHYI7AHIE5AnME5gjMKdN7PmhjW4mBrhO0KcG50KlcP3fsG1baKxhJLgHlEuKLq+7Afv1g3V3Vcir5WwwrbVrKOlmWhXg83jz+8qoR9ieEPKPl0p+u1sG3yxkmupuk6qOey582B5vZSSOV3MQo0N0mVgdcuwiN81GhTQnVv7P217vdbuDO2LBSvS5oF199XRA1P9PXdQGBOQJzBOaUffPobxKLRtr3z0272w9vGATTnEJgTgdWuXrHYxP1849PY/rFfcHVXl9IoB8IzBGYIzCnEXaz0UDLE5jTgVbvYvYfNI1yBb1cCGWPj5rna41X2aXjFZdN73bMd7Jenurxwz0ESdlnRX8rwakYwjwHmL5O69aOg/Ocq53ZSHnHt913VAghhBBCCCGEEEIIIcJM+S0Q2P6CPu0pIjBHYI7AHIE5AnN61L//mxCYIzCnfVfwu79gwAjM6V4X/Pf+guVgd4CY/AAmF3PWjPDM0AAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-female-vanilla-cloud",
    "name": "Vanilla Cloud",
    "category": "female",
    "description": "Vanilla Cloud: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABnklEQVR4nO3aOU7DQBQG4H/+TAgVouAqUHAFTI3gFAjSgMTag7gCQoCoMRIFNQWUFIibhGxGjoDIUZxxcLzx3idN7PGMX+xny4s8Bg7tbiuY1F53rG/svEGJEcIRwhHCEcIRwhHCEcIZ130+a3MFPyfYJJ3iHnY6qD5COIZHN7bUGsOetQZeX56H029hn0kxKn8G1MOfx6c99D6xsLiEj/c3LK+sDpZVYQedgm4rSFKury7HzrtK21GK3n8TbmTSzje3d4Pp1uZG4j/olPwuYKZJwF+UPgGYsaDfTZVQQ5trQgjhCOEI4UzQa6e7CJqYHJpatB70UATXNYUQzmYWOTziP7lPcI7d+36kvu55yAMhHCEcIZxF2fW7mYYnhLOZRi/8ZTePt0FGc3h8cvo773lrg6nvPwzbjw5j+49zfLCfavNcH2fNrBNQtmuAKwF2dMHZ+UWkvruzPbm92Uy1gUoppZRSSimllFJKKZUnkzZAZuMLchpTRAhHCEcIRwhHCGf/+/d/F0I4QjibOkLQR5URwtlZB5x6fMFIe96+AHe52rb3gjD5AAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-female-strawberry-milk",
    "name": "Strawberry Milk",
    "category": "female",
    "description": "Strawberry Milk: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB6ElEQVR4nO3aPUjDQBQH8P89UoWIiKWKgluFuijiIAgOtoMuCg5OnZ0cFBGc6yq4uAji7NRB0EWHKk6CINLJQZ3EbywOBuoSaQPVSpu0pmlj3/tByd3l+pq85i4HiYKDj1TatNuvDwdtv6+CfQo+RmCOwByBOQJzBOYIzBGYU073ea+1xYYauk7QKulUbrFjXL6hqYeAHh0olLfXtkqWf/b5j5T5dld+CHR2wzi+gh4dBI4urLbJkULZCASsBGSey4Zwukr8PQQy1omd7Cfz296ebuD8FA9Zq300ELE9+aa5C0yMj+H+8QmR/nD+kyvn2pqBsh0Cv+wm9/Lb+NxsxT/g9yGgqknAX/g+Aagx8/rFVUJVf1ddE0JgjsAcgTllpl1Ognpr6fZwqLh+84pGcJpTCMxpnkXO/eMdulV+Nxy776cOi+ozsSnUA4E5AnME5jT4XTDraXgCc5qn0SuY/RtNmWe37hZCofaiamJzvVCejk3mtwepo+/9i6tl+5eSSCy5Ojynh7Oq1gnw2xzglADtd8PG7k5RfSU+b79/cdnVAQohhBBCCCGEEEIIIUQ9KbcBPHu/oE7vFBGYIzBHYI7AHIE5rdmf/zshMEdgTnMdwfh0GaAFjURgTqt1wKrfL0gs1PoQqvIFx4F9Ob1PCd0AAAAASUVORK5CYII="
  },
  {
    "id": "pastel-female-sea-foam",
    "name": "Sea Foam",
    "category": "female",
    "description": "Sea Foam: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB4ElEQVR4nO3av0tCURQH8O873BYNLAgq8A9wiX5MDUK0BElLEQ3NRuFQi7Q09we0FIFBc0QtYdBQBApNuTpHQ+GilG8xKLyYqJRPuz61d85nuT/e8/Au753ngXctOLh6fv5sdnx+UDX9vX9ozEIfIzBHYI7AHIE5AnME5gjMWU7/825bCgZ7WicopxOcCp279w94PgV8gVFsHRzrtrbvBVYx//JrCpQXaRdedZvIZvVcNBSq9tfHh6vn/PUJ6fsU+FZeePr+BunXJ0TnFvRcs4V7IgXsygLL7enJke5PT03qfu0xz6ZAo7PzC92ura6gVZ5JgXYX/l9YnQ74UCwa1RWzfn9XnwgCcwTmCMxZt/m8Uc76BgZ+nJ/x+erGj7aNXnB6pxCYU24FLt/xQOUpKLRw91PJZN04HImgGwjMEZgjMKfQ5yZKb67GJzCn3Azeytu/15RdKqGThVBif7/aDy8u6jZ1fV2di+7t/Xp+rWwmo9uD3W24ybrK5YwqwZGGiq/f3gFOX6dV48Tl4WHdeDkWa3p8Ix43ukAhhBBCCCGEEEIIIYToJss0gFv7C7q1p4jAHIE5AnME5gjMKa9//3dCYI7AnDINYLq/AGZ1kDECc6rTAdvdXzC/s9npS2jLF/ABiGXr3iruAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-female-cotton-flower",
    "name": "Cotton Flower",
    "category": "female",
    "description": "Cotton Flower: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqElEQVR4nO3aQU7CQBQG4P89piWR83AIEli4McY7aIiJonFhT2A4hTFuYeXGA3AeDSk1NYCiVeiUTMsU3vs2j+m8TmYm7TCEIVjEcZzm1QeY5d5PYYtQYwzhGMIxhGMIxxCOIRxDOLJ9z1ctDEOv+wRTJGnTZmeGAAf9CgRBdoAX9zeZuC5n35j8reyvwQVH6Bx3fmIma3MbdX9KOLd29r6ML6+389BpLwe+iF/XVjl7itL4rdAi+Pj0jLPTk3+fbWxPgO9FkIpOwPfA54oO/iAmgMLWxpy8ur2ZAJQsTVOnfQUR7XRCGMIxhGMIR0maOL2zDTRQZ7Y1hSGcqbLxCSaL2EbbmjsajTLlXq+HXWAIxxCOIZxB3VX8a5MhnKmy8SKrv280TaZOG6Fmo5kpR1G0+tztdhdxPB6vrV9X/iu6u3bpnvXPWSp7Auq2BtgmwPy9MHwYZsr9y35u/eBq4NRBpZRSSimllFJKKaWU2iVybcD3+QLXM0UM4RjCMYRjCMcQzvjugO/T5gzhGMIZ1waSj8Tpft/HLBnCmbIb3Pp8Qf+87C5s5RNx5nPdbRF+kwAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-female-lilac-breeze",
    "name": "Lilac Breeze",
    "category": "female",
    "description": "Lilac Breeze: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB1klEQVR4nO3asUsCURwH8O/9eAa5tFxBi0FKWwQO6hhOSUFDBCH9AzW4tPRHNBkEbUEoUTQEDUEQjdLQYLbp0BSUs0MNhpbmmd1TztPT3+8Dx7u79/OHd0/fe3rPgEbuKFe1qw9vztq+fmJ6zoCHEZgjMEdgjsAcgTkCcwTmDN0477bYbmyo8wQCc6QLqM30GlvmNmMpdbPAUaDsLsJnzuCz/PazH0AikmiWDdGdpWZMJ48Xr/Ay6iU4sDyJ59w9Evu/N2DUkV1la8ueHh9iITRf32r7nWJGkeo2cGtjHWeXV839caF0AbWfsx/vL9VOF95aN6qMficsXhcd3ZDQWmig8wICcwTmCMwZ+fO8o++s3+/veD64GLQcl55KGAZdn0JgTrmVuNbifvP701EpV7Txdw93luN4JI5BIDBHYI7AnILHBaI+V/MTmFNuJu+m9x82Vak4e5PtE6F0Nv1nKGsd4lLJ1L/xrQrFQr08iO7BTUbuxNm/wqZpwst9gO7ptGo/kb3JWo6TK0nb+tS2tUWFEEIIIYQQQgghhBDCywynCdxaXzCoNUUE5gjMEZgjMEdgTo37838dAnME5pTTBE7XFwBTGCYCc6rfCXtdXxBedXcFiM4XHqhzafnPuQ8AAAAASUVORK5CYII="
  },
  {
    "id": "pastel-female-honey-bee",
    "name": "Honey Bee",
    "category": "female",
    "description": "Honey Bee: pastel female imported from custom skin folder",
    "model": "slim",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvUlEQVR4nO3aMUsDMRQH8H8eEeSK1MEvILXoUgfBTyCIoF0ddBUHBxcRiiCUTl10dBBXHVyr4HcQRXSSKqKTg4MOLTidXFtLK9pcuUvvvPd+UC65pK9NrpekXBQMardrbq9yJ1Po+X6VmlCIMQJzBOYIzBGYIzBHYI7AnDLN87alpo8iXSdoUwXTQqf+WEZibwEnt28M4KdOnGnTFW5zMrisrGI2f9w8zpU6igr/9hei3NqD7zHgvvrUOE5mx31/gKkDoh4DyG/Fk9NKo+Hey0snhfZbcWU53264l2bXAUlr+DcVdkD3/SDQukKNbgx0TCAwR2COwJxyX0vB/gsMj/1+Pp3tzn9UEQXTmEJgTluL7F3xtNNK143VKxd3Xfn8Qg6DQGCOwByBOY24G5q3Gp7AnLYa3cfoHzWNzzeEuRAqls/b6aXWVHbWMcUVC4t/1u90dfPSLN+1ewso93kz2EowPYU4jwGmp9P654m9w+uu/Nb6TO/ybcsdIIQQQgghhBBCCCGEECFSQQNY218woD1FBOYIzBGYIzBHYE4n/fm/CYE5AnM6cISg+wtGECkCczrsgH3vL9gJ+xv05wulVmEVmjaMngAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-male-cotton-candy-boy",
    "name": "Cotton Candy Boy",
    "category": "male",
    "description": "Cotton Candy Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB20lEQVR4nO3av0sDMRQH8G8emVxEaQUXxT9AFG9xUTdFVFyc6qKT4o+p6CxOIvYP0MVJJ0GKFlFEQReXE5w6Owm2KC6uJ22ltYVeWtJrr773We6uSV4vbUjecVEwyJw8eX7lkele3/aqu18hxAjMEZgjMEdgjsAcgTkCc8q0zgctujja0jxB19ugMvHJXr2hnelaKk0l1koXidKpe3uOdqd9U9muHuDzvdhp13XhOE7xmBOJDRXqVBH2EUL1VHbvUzg62C12/j/QvqW//2xuqJ+eJfPnzvAg4qtLiC3Ml9VpV8r7eDWuAtWGselJ0K9tWFYBAnOq0QE9N2OVVygn2tQRQWCOwByBOeXdmVcBX50d1ctGIoXjcxatYppTdKDf3sKO10oHGTwVKYyAmaz5h7h4uC67nhufQjMQmCMwR2BOI+wGvgMNT2BOBxm8ltm/1TS+LIdYRSK0c7hfPJ8dm8wfLx9vSuUr21Xr/+WmXwrlexsIkvLO03aZYN9vthfSOcD0dlpXfpBIHpddx+eX/cs3t6xuUAghhBBCCCGEEEIIIZpJ2QYIdH9BE/YUEZgjMEdgjsAcgTn939//mxCYIzCnrSPY7i+AXSJki8CcbnTAuvcXTKw3+hbq8gP0g3Fd2ZNx5wAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-male-lavender-gentleman",
    "name": "Lavender Gentleman",
    "category": "male",
    "description": "Lavender Gentleman: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAACAElEQVR4nO3aP0hbQRwH8O/9PEjIKIlLuzhYKtJODUImFbGIFFocFDfFblIn3ZzcBIVCOzkUBEWHqiAOFfoHCgWxHRRCitKh0CxNQKeQ4KDkAo8k+PISXl7yfL/fBx537+7yyztydzl4p+Dgy9uzm1r1ifFwzc+HHz5S8DECcwTmCMwRmCMwR2COwJxy+p/32tD8U+XrEZAYD9+52bErD+QUCD3owe7nLQy+eWKuYr5YFgQq/+/cdgqEumIo/M+Yzh4uH5uysaV+Kz8802m1sfPjY97XU0DX27DYcVxfmcvkARTSF2AxBQrpC2y8XzO/dPEy+QB03nEElA/tiZcvsLN/YOXvanMf6UYal3c8KFSzA6b2Mq72Fb2vYi1dFAnMEZgjMKd+bf51NWcjkYht3eO+qEl/J7NoF6c1RXv55e3seL20l8Ej0dLoyGVzjm2/nnyquB+MP0crEJgjMEdgTsPnuuOXnsYnMKe9DF7P6t9uOpdz95DVG6F32ytWfuDZiEm//TyyyuYmF23bl0v+OTXpavw1vKS+r6dc7QSj0dJuz69rgNPbaV1dsH30oeJ+cmS6Zv3c1IKrBxRCCCGEEEIIIYQQQohWUm4DeHm+oBVnigjMEZgjMEdgjsCcDvr7fycE5gjMabcB3J4vADrQTgTmdLMDNnq+ID462+xHaMgt4yKFPsYo1dMAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-male-mint-fresh",
    "name": "Mint Fresh",
    "category": "male",
    "description": "Mint Fresh: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB7UlEQVR4nO3asUsCURwH8O/9elFchEsitYUpRY01BtFgQTS0RLS4BFFI0NKf4NDQ0NBSQw1BtDg05dBSWy1FIUQ2RRC2NHRDQkVKl4beKed56u/3AXnPez9/3tPzvSf3NNjYSZ1/WbVHfQHL13f1hTU0MAJzBOYIzBGYIzBHYI6cTIGtQPO6k6tD456uE1Slgf8XPAdvL2AxBkR9AbPzU/G4WRYeb2bKqhN6wA/jJZOv94YwOD1hlr9WwiNmTCmNfqVQNcExXy+uL5LYnYmiVZBVY+E3u7+zhVCwP/f4qZeKaUaq0sD5uVkcJ07MeqtQdgE/f2ffn++/SnW8sK1ZabVOmMg8OPpA5vwDdV0XEJgjMEdgTjt8Sjn6zeod7WXbhnuCufLuNQ2v2I0pys0397LjlVJuJtd1PVcahmEbe3l6VvR8bGoS9UBgjsAcgTmFBhfJfrqan8CccjN5JaO/15TxkUUtF0JHm9tmfTSSn8qukn9T3MLGWtn4Qunr21wZWY/BTdru442jlWBPd36ub9QxwO7utPp/ILl3UHwCS1HL9sX1FUcnKIQQQgghhBBCCCGEEPWkOU3g5v6CeuwpIjBHYI7AHIE5AnOq1e//2yEwR2BOOU3gdH8BOtvgJQJzqtYJq95fEFuu9SlU5RtDgXx2K7ntZwAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-male-peach-sunrise",
    "name": "Peach Sunrise",
    "category": "male",
    "description": "Peach Sunrise: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB3ElEQVR4nO3aPUjDQBQH8P89DocIolL8GFsEN4cOxUFRdBHRRdyc7drBSRd1cHRw1dlNXBRxUSp2KBUdpIOTbioOOllwirRWawvJRdI0se/9oOSSu7xeQ5J7R0/B4D17YLvVWyNJ1/NVb0IhwgjMEZgjMEdgjsAcgTkCc8o0zgetc3Ix1DxBe2nklOyUbm/A6hHY3dyq27YD7ZrK9vShdHFaLceRnp2qbausiRng7cUxRNTvEu2lUTaXB5DH4EA/cHWGpw8F5PJIdXWg7R8BaySJybFRPD6/YHgoUfmUy+VjponQf6Ds13vjKOB0G3u5AKZHIOxRgEwN3KazUZ/qeqGaHdC+L/jKK1Qi1dKLSmCOwByBOWUXs/7mApblXBevjhIP4SVDpneKDvTbQ/zhXulAo3/fHaWSsenR2WXd/vz0OFqBwByBOQJzGlHXHQs0PIE5HWh0D2//sGnfnWxIhDZ29n7Kc1Njle3xea5Wn1l2bP/bdfHuq359FUFSduHEXyYYi0X6HWCasuvGA9v7h3X7K0sL7vWZtK8OCiGEEEIIIYQQQgghRCspvwECXV/QgjVFBOYIzBGYIzBHYE63+///JgTmCMxpDosg3BCY080O+Of1Betrze7Cn3wCHMNrXc2t94kAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-male-sky-dreamer",
    "name": "Sky Dreamer",
    "category": "male",
    "description": "Sky Dreamer: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABzUlEQVR4nO3av0sCYRgH8O/7+IIgJAgK/QUNLWIOTbUE1WBTNTQLVtDQEDVE4NzUVDQ0N1RTDtmoU4GBU+DcECgEBZJgGGkeauhp53nq83yW5+7e18d78d4fcq+CiUSuXOlUvjz51vHz2htQGGIE5gjMEZgjMEdgjsAcgTllNs/bLTKlHV0naLMKZgudu1cfRhmBOVV+z7ftAq4JP74+Csbx2QOwPYtqjE0X/tT5zxMy9F2g7qeR4VIWjykgFgpiXFCnwsZf9vLqphrDoaBx3Fpn7LpAq3rDN9ZX0a2x6QK9NnxUqH4nzOQrltYV4YAa6BNBYI7AHIE5lX6x9l/A43a1LZvx1+KTgzOl2Zii7fxyJxveLW1nco+7Fosl87qp5G3T+fzSCgaBwByBOQJzGkMu6LZ3JCUwp+1M3s3o7zRdLJbRz4XQ+XHcOJ5bjFRj+j5hXNvcj7et3+g5m6nG06Md2Eklc5+WVoJ+3+9kP6RjgNnbad164fripOl8LbrbsXxr78DSDQohhBBCCCGEEEIIIcQgKasJ7NxfMIg9RQTmCMwRmCMwR2BOj/v7fzME5gjMaasJrO4vgBeOIjCn+52w1/0FC4fRft9CT74BHft0ekSGupwAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-male-lemon-zest",
    "name": "Lemon Zest",
    "category": "male",
    "description": "Lemon Zest: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABxUlEQVR4nO3bMU8CMRQH8H+fTWADE+Pk6mTicoPG1cEFjJvExMUPoCSYGDdGB00c/AYmBDcjLA6uBodbXF2djANuEEnOgHjhSLxCjnIH7/2WUtp70GuvV3JFwaDZvPTCyjPpQujxKr2ikGAE5gjMEZgjMEdgjsAcgTllus/bls2eqpkZAZl0wbjwmTXaVKHbYGdrt5+rBMrc5wd8taqYZTq0R1PLQPvDz7quC8dx/LQrkzkO1BmW9BNE41X/hus2/MazuAT+hnrl7t7v6dLJEQ729zAPlNd6H/ku0DsJwFiNN10Ccd8F9DiV56XXB6lJB/S8x0jrCqV2pjoiCMwRmCMwp7xONdpvgYXFkML1fvqKuJjmFG334+Nr+Ki03fBL/fTTWLNWawTy+fwmpoHAHIE5AnMaSddesxqewJy2G948+8dNoxPxSw4thMrlW/91LrfRS+v1l4Hyw3/rD3Ldt9/y8wvYpLzWTbSVYGoVSZ4DTE+n9fAbV9dPgXypuB1efmb5BAghhBBCCCGEEEIIIcQEqagB7O4vsL+niMAcgTkCcwTmCMzpeX/+b0JgjsCcjhwh6v6CmBGY05MOOPb+gmK8/0H4AdqQajsFk9BXAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-male-cotton-gentle",
    "name": "Cotton Gentle",
    "category": "male",
    "description": "Cotton Gentle: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqElEQVR4nO3aQU7CQBQG4P89pkr0Du4UE2NMOAfcxE03bHRR9yZcwcTEC5RzkLgw0YNIsMXWUIMIwQ44LS289yVkpn3TSTudGYYwBIvxeJzmxQ/5M/d6Ojgm1BhDOIZwDOEYwjGEYwjHEI5s3/Nlazabla4TjK2AbaHzkTSw/0PAO8Lt3X2WLuT3AKXR+99DYPqQ8ShLh8PX7FS7fT7PX57My/yzh1Q9BGjdBph6e3nO0tbF1Xd8FtvhBuDc6OzB4hGeHh/QOjvNPtP879guo9weYHmLtgky79rd6AECUNEVpmnqtK4goq32CIZwDOEYwtFkMnEas41GvZfCtjmFIZwps/I4jrPU8zxr2TAMF4673S62gSEcQziGcAZ1V/KPLYZwpszK15n9q0ZRFKVFPmQQBD/5TqeTpYPBYGV81fGy4KbncnvWP2ep6Aao2xxgawCzfKLf7y8c+76fG+/13N6QUkoppZRSSimllFJKbRO5VlD1/gLXPUUM4RjCMYRjCMcQzlR9A1VvtmYIxxDOuFaQJInT9VVvs2QIZ4qucOP9Bf510bewkS9AJnwkmYpBqAAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-male-berry-boy",
    "name": "Berry Boy",
    "category": "male",
    "description": "Berry Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB6UlEQVR4nO3aTygEURwH8O/79U6KdfAnF0XKRflfpBC3DRchLstFnImrixs3B7k5oMgFOdlC0RaKUi5ycEAoXFxHuyssdmY0Mzu7fr9Pbe/N/N78ZmabefOmeQoWnmdWDbN4IFRnur3KL1VIYwTmCMwRmCMwR2COwByBOWX1nPda7nivr+MEbadRssHOy+IxWN0CC4PTCeV/oE2HsnkFeJndfq+XYLim7bN8FxgLAo/3SVOk+1Wi7TTaPYgAiKAoWAhEwritVcBBBNX2Ns/sWyAQqkNrUwNu7u5RXlYa+0Xr0XVWL0KZQJtGv1zaA91dWF7f+Kj/1iYTaasG0ddZ4+HK+HHi32KZSrmd0Ng4dfSHqK6qlI4LCMwRmCMwp4ylQ2edWHZW8lhFZbw8P4NfrPoU7enefTxxu7Sn2Yvz4uX1o2XTzaO9hOXO+hakAoE5AnME5jTSXWOOp+kJzGlPs9vo/f2m8fQKNwdCUyvzH/WO+uZYuXW0/xnvH0na/quTy4t4vHECXlLG3I7hyrM+TfsAq6/T+vuK2fBawvJYe495fGjU0QEKIYQQQgghhBBCCCFEKimnCTydX5CCOUUE5gjMEZgjMEdgTv/37/9WCMwRmNOOMzidX+AzAnPa7YR/nl/QN+n2IfzJGwW1cMpQf+WRAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-male-cherry-blossom-boy",
    "name": "Cherry Blossom Boy",
    "category": "male",
    "description": "Cherry Blossom Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB00lEQVR4nO3aPUjDQBQH8P89bpBIOwnWUSc3UcFJUVScdPALQWcFJ0EnN0cXBydBwU0XRUGdCoqoU6FODk666tpicZEIraQf0FwkSZP2vd/yLn3XC5ePu4OcgsHX+b3tlremel3/r5IphRgjMEdgjsAcgTkCcwTmCMwp0zwftvaFsUjXCdpLpXqLnUL6FS3/ClgVnT/c3K2KplVgM9CunUh0AvlPp7w2OV2Of6z50XKdJnxK6D+Vs10/yD6kgaUJtApyzVbc2dPjg2Ic7O9zyrV1mpGycx+eZ4HTs4tiXF6c83wC0ysQ+1lAJVPORarteGWuWamgG7Qzb74uiBrqaegTQWCOwByBOWXfv/gbxCyrfm6guxSf3xEV05iiQz17hB33SofaeqKtFPPfxqrXj7dVxzMjjVltEpgjMEdgTiPuel1mmQAQmNOhtu5h9I+aRq6AIBdCO0f7Tnl6eLwYb57uyvnVjbr1K2VfX0r5vW2ESdlXGX8rwVQH4jwGmL5O69of9i5Pqo63Zlfc8+vVd1QIIYQQQgghhBBCCCHiTPltINT9BQ3YU0RgjsAcgTkCcwTmdKt//zchMEdgTvtuwe/+gogRmNNBN/jv/QVj4e4AMfkF1+Nvurqsf3kAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-male-vanilla-boy",
    "name": "Vanilla Boy",
    "category": "male",
    "description": "Vanilla Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABgklEQVR4nO3aS07DMBQF0OsbQ9kbYS8IOkICCnMQqwAxJuyBAWI99JMEhQBtImqnyrd570iV409fa9dynCYGHovVZ+qqP/C839gjgwEjhCOEI4QjhCOEI4QjhDO+83zbDnveJ1hfg82NztJRtq/sLo19u759xKxTW1/BZN0ymODj/W2d/sjauGIMnUlda0A2APG8mM+UyzbzJcuBrwGs2vDx6TnvaDzPj0fCOGeA51esMsVHMwPGyjQdME1WtfYVhrbTGUEIRwhHCGfSeFHvWsA4xtAEeZrG6ItvTbGtfnqPHa/Kthr9d+wrzLGXKCrkT8IQXSCEI4QjhLMYumTVanhCONtq9F7/bWzwctiJxTGc3dz+HYfh8XcaRa/r+uurre3/M7u8QB2+m7Om6QEY2hrgGwBbLri7fyjkz89O3fXTaa0vqJRSSimllFJKKaWUUl0ydQO0+nxBB88UEcIRwhHCEcIRwtmx3//3IYQjhLO1I6QJ9hkhnG064M7PF5Tqu/YFhHZib8AXe78AAAAASUVORK5CYII="
  },
  {
    "id": "pastel-male-strawberry-gentle",
    "name": "Strawberry Gentle",
    "category": "male",
    "description": "Strawberry Gentle: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB5klEQVR4nO3avy+DQRgH8O89bpCKpERMFj/CIpb+AQQJA2IwsRmEQQwdjKwGxCZGCZNBMJAgfmyki1gYiEQMhlYiuhheqSalor23rm/ft57ns1zvvevT9572vfea9xQM3k6unXztoY5w3ver2gaFACMwR2COwByBOQJzBOYIzCnTfd5rVV3tvq4TtJtOuRY7yasXlDvtplOkd+jX4+dL6yh3Ou9StqYeydPbTDUWiyESiWTKlFBnK5B4zhki6L8SMnX4nqCbyzNsri5/Dd7wP6D8L4FE+puNHe5gc2sbbS3Nn/Xo5DhGR4az+pQr5cQfXd8FUklIyQzeBdMl4PddQBWSgL8IfAJQZM5d3Cqhqqm2pAkhMEdgjsCccq6f7CbBUGXutsaadHmfgF9Mc4r29NN9HLhb2tPo1aF0+Zo0dt092s+qD/b0oxQIzBGYIzCnEXRh8/xhg8Cc9jS6i9nfb8q5eLBbCNVVZ1XnVxYyrwe6+z7LveODr/aZ2Zz9fzM/N211eqaHs6rYCQjaHGBKgP55YHFjLaseHZvI3z4TtTpBIYQQQgghhBBCCCGEKCVlG8DT/QUl2FNEYI7AHIE5AnME5vR/f/5vQmCOwJy2jpB8twxQAT8RmNPFDljw/oK5qWKfQkE+AGKldhPdM2W5AAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-male-sea-breeze",
    "name": "Sea Breeze",
    "category": "male",
    "description": "Sea Breeze: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB6klEQVR4nO3av0vDQBQH8G8e16VVdBCqNJsKgos4dJCqczuK+Bf4CwddxMW5uy4F0b9ApE62joriIKi49Q9QiLhUtF0qKI1abCFNyjX99d4Hyl3ukpdcyUsOcgZcZJ6evur1z/epuseHBocNdDACcwTmCMwRmCMwR2COwJzh9p73W8I02zpPUF52cprsXH58gkUKBAfCWN8/sMv/9V5gFPKWYwqUB5l9fkY8EsFRLme3LU9MVOqR/n67r/j24ngCt7ukK1Lg/OwUJoCR4TAe725gWj8D/pqKgkUKzMVmYFkWxsdG7V+5Xm7r+RSodXyStsulxQV41RMp8KeRgXcLo9kBbwsFrXlFNBRq6R1BYI7AHIE54yKf18rZYCDg2DcdDNrlfbGIdnF7pig/T97OgXul/Aw++HsH5D38EVeZTNX2bCKBViAwR2COwJxCh5ssvfsan8Cc8jO4l6d/u6liqYRmToQOk8lKPRaP2+V1NltpW9ndddz/v9zDg13u7WzCT0bm9VVrJjj0+67v1GeA29dpVduQTqWqthc2Nur2r25va12gEEIIIYQQQgghhBBCtJKhG8DP9QWtWFNEYI7AHIE5AnME5lSvf/93Q2COwJzSDaC7vgB68yBtBOZUswM2ur5gfmut2ZfQkG/w3X+Oqtd+tgAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-male-cotton-field-boy",
    "name": "Cotton Field Boy",
    "category": "male",
    "description": "Cotton Field Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpElEQVR4nO3aXUrDQBAH8P9MNylU8NF7qPQQgfbBgyhF0Ao+mBNIjyAIXqC9gg9SPI5SkmiEoq0pdbdlkyZ15vey2exkWTbJfsASHJIkyW3lAVLr8xQeEBqMIRxDOIZwDOEYwjGEYwhHrnm+amEY1rpOMK4A10InRQAxv8DF3U0h/Q+M9Q0HHSD9Lg86iM6iZfoTEgRA+r63XwhvE3z0eYjXl2dE3WUH7Du2lv56s0+PD/P09OR4cb0as48oT96cs8Bfn7FrgLQ925RZgF0Btu1s07e6m6CyK8zz3GtdQUQ77VSGcAzhGMJRlmde/2wLLTSZa0xhCGeqrHyK6TztouuMHY/HhXy/38cuMIRjCMcQzqDpKt5sMYQzVVa+yehfN5plM6+FULvVLuTjOF5c93q9eTqZTNaWr8uvim+vfZrn3LFS2R3QtDHA1QFm9cboflTIDy4H1vLh1dCrgUoppZRSSimllFJKKbVL5FtB3ecLfM8UMYRjCMcQjiEcQzhTdwPqPmzNEI4hnPGtIPvIvJ6v+5glQzhTdoVbny8YnJfdhK18ASlzYSFOGhtJAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-male-lilac-boy",
    "name": "Lilac Boy",
    "category": "male",
    "description": "Lilac Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB3ElEQVR4nO3aMUvDQBQH8H+ep0PBLeoiit0Fl1ZX7RQXBRehuCmOBcVPoUtxEp2UgoOCLjrV3boIdhTFUe0cRAel0ca22FxLmibxvR+Uu+ReX5vkklybM6BR2i99erVPLY54vn9gaNxAhBGYIzBHYI7AHIE5AnME5gzdfT5o6bV0qOME1U5Qq8HO7dkzWJ0Cm+s7DeV/oLyGsv3mMG4O7n7qY7BmLLesSa1O4qPy0jJH1HsJdRJsbc0CeIO19bsD4o50AbUecrS36xzp6qtar2+LM+XVWN+1l5cWcHx67tb/iokjpQuo/px9f336bN7w5ra4Mrqd8OHiwdcOSc4nezouIDBHYI7AnFE+Kfs6ZxOJRMu2ickJp3y8e0RYdNcUFeSHh7nh7VJBJk+Y373Drtja2OJ1sWE5M51BLxCYIzBHYE4h4kZTfYHmJzCngkzeztU/bMq2/X3J5oFQvpB363PpOae8Kl2563LZXMv4euX7slNupzYQJKN06O9fYdM0EeVrgO7ptGpeUbgsNCxnraxne26l8YgKIYQQQgghhBBCCCFElBl+EwQ5v6AXc4oIzBGYIzBHYI7AnPrvz/91CMwRmFN+E/idXwAMIkwE5lS3E3Y6v2DKCnYGiM4Xtpd14m8xxMIAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-male-honey-boy",
    "name": "Honey Boy",
    "category": "male",
    "description": "Honey Boy: pastel male imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAByklEQVR4nO3av0sDMRQH8G+egUpLncRJBIUqLgoO7uKiqB0dBMFF1FkqCg7i0kGcRRwFB0d/oIv/gKCoi+igKE46CBaLTif2qvVXe6136bX33gdKcs3ra3MlubQXBQcv51NWofZQU6Lg61WkRaGCEZgjMEdgjsAcgTkCcwTmlNN13rTa9hVf1wkE5rRTgNNK7/V2CdVMWc9X+YdAuAFI32frzTjeHUXXwLpd9iz+jvnHCaqeIZC+RqRxDBenB7nOBwAVbP3yzW5sbqEt1pJ5vNf/ignkHPBhZDj+2fH3elDoUoKD1PEPyuuE1tOaq3WFqhsv66RIYI7AHIE5ZT0k3f0WCNXnb4u22mXqEn5xmlO00Xf3sePF0kazR8N2mUo7hm7vnX47HurvRDkQmCMwR2BOo9LV9BpNT2BOG81exOzvN43XR3i5EFpI5v4rGOzryJQ7+2e59rl43vivjk5u7PZ5s0NAWXcz7laCdTFU8hzgdHda/3xiefXw2/H0RHfh9oThEyCEEEIIIYQQQgghhBAeUm4TGN1fUIY9RQTmCMwRmCMwR2BOB/3+vxMCcwTmtOsMbvcXZHfS+YXAnPY6Ycn7C2Ynvf4IJXkDe8Jmq33GEoQAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-cotton-cloud",
    "name": "Cotton Cloud",
    "category": "neutral",
    "description": "Cotton Cloud: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABd0lEQVR4nO3aT0rDQBQG8G++DNT7hLrwDM1a9BRFkOJCyAmkR1DUiuv2DC4sWbkQbxIhZYQshITQpEzzp3nvB2EymckjTMhMMhmDGi5LHTwYe2YwYIRwhHCEcIRwhHCEcIRwxnec976Ant8TCOFsk0rh+UXl8eTzA6eOe0uDSSGbJEkhrapzanhI5Z/vL6xeHhGGIUbDZalrsr0+P1Xu+24nNQqs3t7z9PrqcjSjgOn7LvTeADgy55zf/IExnTYIIRwhHCGcyVzm9cwGCDBkdX0KIZxtM/gW2zydYlpbd71eF/JRFKELhHCEcIRwFkO3+201PCGcbTN4k96/byb1/BqclGaE4jj+35/NZnm62Wwqy6vyZfH9Xatfm+bYDTC0PqCuAWz5wPJhWcjPb+Z7yxe3C68LVEoppZRSSimllFJKqS4Z3wB9ry/wXVNECEcIRwhHCEcIZ8f+/78OIRwhnPUNkO0yr/P7XmZJCGePHfDg9QWl8q79AYNo09i4fh6bAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-neutral-lavender-mist",
    "name": "Lavender Mist",
    "category": "neutral",
    "description": "Lavender Mist: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAByklEQVR4nO3av0sCYRgH8O89vGAI0SIaDUXtFjj0Y80IsiFoaZBob0ia+hsiKKKhOcEhiKChAsnWyDGdIoqaMtoC0anwNQ4t7Iz3zhOf57M877338Hh36vu+4mvBQeX1+RMG+gZHLHQxAnME5gjMEZgjMEdgjsCcZTrPm/J7nUBgjtpJCkSGsbW+q2Nju+cfQCASttuJ6QSyO9lf7cacnhsDApEwqqU3+92+yZ7rODO/qGO19GLn9OQYUP2+sdqNpg8PdDs2EdXtWl9jDotZ4Pj0TMeV5SXXLsDvT4DFfRq03C74eGH2QMcSnX0gBOYIzBGYs4on90bf2WAw0PLcaLS+fngq1KdMPziNKcrLF/fzxtulvCweDPXrWH7/cMzN3V41Hcen5tAJBOYIzBGYU+hyQzFv6xOYU14Wb2f095sqlytwcyG0n9mz27OTcR2v8zm7L5XcbJnfqPhQ0HE71pzvNiufvjNaCYZCA+jmMcDp57b62ZG5PGo6Ti6s/Xk+tbphdoVCCCGEEEIIIYQQQgjRQZZpAS/3F3RiTxGBOQJzBOYIzBGYU73+/78TAnME5pRpAdP9BYDZQsgUgTnldsH/7i8Yn/d3f8EXogJ46Qu+6aAAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-mint-dew",
    "name": "Mint Dew",
    "category": "neutral",
    "description": "Mint Dew: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB0ElEQVR4nO3aMUvDQBQH8P89DpVIB0XUSYc6iat+ACtYBB0cFMHBSRzsUBz8CMVJN8FB3BQHB10q6BfQSewkdqiTOuggBqyD0lBKq23ScknT9r0flHfJPV5zIbmk9BQ8fD4//sBA7/CYQgsjMEdgjsAcgTkCcwTmCMwpr+d84TleK8etr13eE8grwW2ApoNvu1tgLpWqiJ2A3DqtocGydhTjc9OlWC2nHSm3y7gwOPvltdiOAvgo9kRgv2T/5XTcHGCXDexof8/ZLnwK7Wo57Ug1MpGdnl04cWlx3rcDCPsKUNwfg8rvgudvOaMTstA/2tQTQmCOwByBOXXy/GB0z1pd3TX7JvpGnJh5f0JYvOYUHeSXhznweukgi1uW5UTbtj1zb9JXFdtT8Rk0A4E5AnME5jRaXCz/HWh9AnM6yOL1zP5h0/ZXHn6+CB3v7Jbak7MxJ95eXpf2rWwna+aXy97dOzGW3ESQ1GEuY/QmOBCJoJXnAK+f2/rvjvTBUcV2fH3NtX91K2F0gEIIIYQQQgghhBBCCNFMyrRAkOsLmrGmiMAcgTkCcwTmCMzpTv//3wuBOQJz2rSA6foCdPcgTATmtN8FG11fsJzY8PsQGvIL45mPMWkhpFsAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-peach-glow",
    "name": "Peach Glow",
    "category": "neutral",
    "description": "Peach Glow: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpUlEQVR4nO3av0sDMRQH8G8embq0QtGtBREc9S/QoR0rLooguEodi5NOB87i4CKCk9BFF9Gxgjq4FRSH0rGOTrp0PekV215p71rS++G994GSXN8jTcOR5Lgo+LC/WzYMqExeIcYIzBGYIzBHYI7AHIE5AnPKdJ037kDE+wQCczRN8qV14iqTPwDp+YF6DvulYr8clZP0O6CZWUCz/gQUdpAU5Bn9+epVq1fnWF5adD6d+qicxK8C1ds7p9zd2kzMKqD8BqDTwXE5XrF/MwCYMbv1ZjYg+dVQB4TAHIE5AnPKbryaPQukUuNjuZVu+fmOqPjNKTrQX4/wj09KB9r6393Rbvum3teeXdcbxXWEgcAcgTkCcxpxl54LtHkCczrQ1ieY/aOmjTs5tBGyzi569VJhzSkfHl/68Up5bP6g+kejG7eOECRl12tmO8FsFnGeA/wet/XwF6fXN67rw71t73jlwKiDQgghhBBCCCGEEEIIESZl2kCg5wtCOFNEYI7AHIE5AnME5nTS3//7ITBHYE5zOAThhcCcnnWDU58vsI5n3YWp/AKK0GQ7G5fvaAAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-neutral-sky-haze",
    "name": "Sky Haze",
    "category": "neutral",
    "description": "Sky Haze: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqklEQVR4nO3av0sCYRgH8O/7+JJgOCj9CRYNQe1BtdVQWwWNLVJTQYPQEK5tDQ3R0ihUWw0FLTW0BTnZ0NLWpFNHgmJkx5Gh3sl7v/J5PiDve/c+PN4d+j6v+Cq4aHxUWzCgR7MKMUZgjsAcgTkCcwTmCMwRmFOmdd5U1OsEAnME5qjfYCKV6eifvWSctlvMf6S9BjatGmYTr6iUgc3JHFh8AppWzemXzi8xMZ5rv7773WKGvgqU7BvfWF8dmiqguJdB5XfC52rL6IHOZFWoD4TAHIE5AnPq8b1h9J1NjSR6jk3ba6RyhJXSbU7RQb55lDfulQ4yeSr501p199j7m6uO4/mlFYSBwByBOQJzGjE3lQx2JiUwp4NM7mX2j5q26g34uRA6OSw6/bnF5Xb7cHvtnNsqFHvG/1YpP7Xb44MdBEndvX0arQTH0naxj+kc4PZzW/89cXF61HG8lt/tO769VzC6QCGEEEIIIYQQQgghhAiTMk0Q5P6CMPYUEZgjMEdgjsAcgTk97P//uyEwR2BOmyYw3V+ANCJFYE77nXDQ/QUL+3m/L2EgXxWGY3dz0UwNAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-neutral-lemon-sorbet",
    "name": "Lemon Sorbet",
    "category": "neutral",
    "description": "Lemon Sorbet: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABqUlEQVR4nO3aIU/DQBQH8P89rggUjlk8yRImAE+mNoNaEFgUYiGZATFNQhAIAjhIFgTBbIrgAVGB5gtsCofYCCVpVzYIrFuu13Z772fu1nd5u15y11t3ChG8btuDATWfU8gwAnME5gjMEZgjMEdgjsCcMn3OG3cg5X0CgTkat+HFeeXP+mxPAWcJ6HWC8n0vuLZwOqg7h4M2UzoF1NgDAMB9vvfLwloxiIexKR4AGhkNb6zXQeP6zK8WVvNBfSjG5inQuLnzy+3KVnwdyPQUSEDqA4CYed6D2fsDtZnogBCYIzBHYE55H7dmi+Dc4ohgvl++IC1Ra4q2+/Xp3fi4tN30uX7ZjmzZbD7++FwubyAJBOYIzBGY08i63orV9ATmtN300at/2jQ+3xDnRqhev/qul0rrftlqPQ3Fd/5tP8x1X4P4wRFsUl730mwn6Cwjy2tA1M9t/fvC8Unw2iu0Xy2Ojtd2jToohBBCCCGEEEIIIYQQSVKmCeyeL7B/pojAHIE5AnME5gjM6Vn//z8KgTkCc9o4g+n5gpQRmNNxJ5z4fEG1HHcXJvIFdK1xGCsPpxQAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-cotton-fluff",
    "name": "Cotton Fluff",
    "category": "neutral",
    "description": "Cotton Fluff: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABcklEQVR4nO3aQWqDQBQG4H9+J7T3EbroGcy6tJcooSB0UfAGOUMpbelaz9BFwfukQZ2SLAoGiYbRaHzvAxmfo4/JmDiTZAxauGLj4MHYa4MJI4QjhCOEI4QjhCOEI4QzvuO8dwNGnicQwtkuJ4U3t43H859vXDoerQ2uamGe57Wy6ZxLw1Mv2L34MAwxG67YuC7b+9tr477vdlGjwMfn1758uL+bzShgxr4Lo3cAeuac8/v9wJizdgghHCEcIZwpisLrMxsEAaas7ZlCCGeHTF6WZed3SZqmtXi5XOIcCOEI4QjhLKau/B00PSGcHTL51OcIO2a73XpNhBaLRS1OkuR/P4qifZllWWN9U3woeXke9Num6bsDpvYMaOsAe3hgvV7X4tVqdbQ+jmOvBiqllFJKKaWUUkoppdQ5Gd8EY68v8F1TRAhHCEcIRwhHCGfn/v9/G0I4Qjjrm6CqKq/rg5FvASGc7TvhyesLnh77bsJJ/gBJDtJ0VJyUcwAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-neutral-berry-sorbet",
    "name": "Berry Sorbet",
    "category": "neutral",
    "description": "Berry Sorbet: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABuElEQVR4nO3aPUgDMRQH8H8emQSdqg5CBREc1M3qqIMoiKLgUNCpi4OODropODsJgjpbdHAQxcGpblpw8gMKLjpqN8H1pK20PWnvWnIf7b33g5JcX3hNjjbJ0Si4sL7eLRhQ3f0KLYzAHIE5AnME5gjMEZgjMKfc1vnCOl6vjVOsXfYJ5NbAaYCmg2+7n8Bxas9WRgE5RmM9VfU41samK2WtNlH/BuRme5G7zwA7SUQFOUbzn+Vq+ugAQ4MDxVehXqtNO1LNTGTpi8tiubK86F0HQl4FFPdlUHmd0Lp5NrshcyOB3hACcwTmCMwp6yxrtp3t6qgfGx0ulU8vCIvbnKJ9/fQQB94o7Wv2eKxUfuRdm149ZGzXCxNTCAKBOQJzBOY0Wl2i09f0BOa0r9kbmP3DpvH9Ay83Qrunh+X6/PhksbzO3lXiq+t121d7fHstxRNb8JOyTjJmO8G+v7W+RecAt8dt/f+N/dtz2/XmTNI5ntow6qAQQgghhBBCCCGEEEIESZkm8PV8QQBnigjMEZgjMEdgjsCcjvr//24IzBGY08YZTM8XhIzAnPY6YdPnC5a2ve5CU34BZoJzo8nEsl0AAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-cherry-puff",
    "name": "Cherry Puff",
    "category": "neutral",
    "description": "Cherry Puff: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpklEQVR4nO3aMUjDQBQG4P8eB0LFQai46VLRWWftoG52seAguCqO6uji6CKd6yQIHQRdFCdd7OJSQTqUjroqOBS7RtpAa6TNtVzSxLz3QXmXvsc1vZa7hJyCgfP94cCCGp9SiDECcwTmCMwRmCMwR2COwJyyXeetTyDi6wQCczRM8fnhqScmfwBSaU97dz3Xjb1qkv4PqGfGUH99BvJZJAX5ZpufnWbpooj5uUz71Wr3qkn8KlC6um7H7a18YlYBZRqA1gn2q/HL/ZsBQMCcypvdgCzNjnRACMwRmCMwp5xyze5eIJXqn1uccePLO6JimlN0qJ8e4RcflA6198kJN341jKW3Tw+e49zKGkaBwByBOQJzGnG34LPKBIDAnA619wFm/6hpNJoI8kLopFjotDeWV9vxrvzYze8d9K3/rVKruvnCMcKknPuK3ZXgdDrWc4Dpdlv/fePs5tJzfLS545/f9/6iQgghhBBCCCGEEEIIEWfKtoNQ9xeMYE8RgTkCcwTmCMwRmNNJf/5vQmCOwJy27sF2f0HECMzpoDscen9BNtwdICY/H9JkGPoZSM4AAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-vanilla-swirl",
    "name": "Vanilla Swirl",
    "category": "neutral",
    "description": "Vanilla Swirl: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABXUlEQVR4nO3a0U7CMBQG4L+/1dcxAZ9C4d7wFEa8NGbxnsSnWLwHfQcTMfFtjKA1IWRhBDdIN7bsP99NO9ocutL0DKhDiRC+AyI4d+bQYoQ4QhwhjhBHiCPEEeJcbJ6PHkDDzwmEOEIci5tPc/XPj/eNclefTq+ABZaBmM/fcN67QFewuHmR1dL0eVX2+72svt2n81kgXd/4aHTdmSzg1NOgqzpgCMvI3w/8USeEEEeII8S5+E2waA5P1uUPmlK2p/h63765G9+Xrzf8/itgOn3NXQ+HlzgGQhwhjhDn0Xq/tUYnxHn1NOhC+ApVzmGSPGb1weBqVc5mLxvtD//23yVJ7mv9tumqnoC27QFlE+C3X5hMnnLX4/FNSftd1ACNMcYYY4wxxhhjjDHmmFxsgHrPF9R/pogQR4gjxBHiCHG+6///lyHEEeJ880u42c+AEOerDnj4+YLbqodwkD+y6lisXIjcjAAAAABJRU5ErkJggg=="
  },
  {
    "id": "pastel-neutral-strawberry-swirl",
    "name": "Strawberry Swirl",
    "category": "neutral",
    "description": "Strawberry Swirl: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABpklEQVR4nO3aMUsDMRQH8H8eQUG4A6Ggk34AN7+Agw4KuggugrODgxRxcKtdnMSx6OAidBFcFHTQwQ/gKM6Kg6VbDwq6nNgTr1da70ruLm3f+y1JLuE1CSS5tlGI4Tc+fBhQ7rTCACMwR2COwByBOQJzBOYIzCnTc964A5bfEwjMUdKGZ4eVrvnRXgLOFODVgvTxOXi2MBfm5wthmyFdAjpxy5+Bd+YNBj4cS8D7HaBXQ/W8EpTb8+1tOJwC1curVrq5sZ5eBywvAcX9GFRpB/RfG2a/H8y6uU4IgTkCcwTmlP9SN9sEJ8Z71804QfrmwZa4PUVn+ukWB56UzjS6Mxak3lds0+v720h5bWkFeSAwR2COwJzGoJtsZhqewJzONHqC3d825T+9m70IFdxIsXRy9JdfXVxupTcPd2F98aBn+25K5d1Mv22qtCdg0PaAuAnQnQ+OL04j5b2t7f/ri/tGHRRCCCGEEEIIIYQQQog8KdMAmd4vyOFOEYE5AnME5gjMEZjTo/7/fxwCcwTmtHGE5qf1LpggMKfTDtj3/YLyTtpd6Ms3thttYbO2qJ4AAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-sea-mist",
    "name": "Sea Mist",
    "category": "neutral",
    "description": "Sea Mist: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABvklEQVR4nO3aTUsCQRgH8P88DCobdrJvkNAtsEuHis567AW/QQlCnTx59F4HIbxU516OCl3z0iWlUwc/QuFBSTSEwsVEC9+YXdd8nh/IM7uzPO4MuzMjjsIYH7W3LxhYWl5RmGME5gjMEZgjMEdgjsAcgTllOs+b8nqdQGCOJrnICoaQOL+wY3954TvA6mvkbjyOq0rlT/m/d4QaNQZ0Gteov/ca+VJ6suN6ZNOOP3WduJBjQKPbsE68vswhHF61P51yfx2bWeDm9t6Ohwd7jt2A10+A4j4NKqcTPjebRh26EQjMtEMIzBGYIzCnirWa0Ttr+XxD6yJ+vx1LrRa8Mm5M0W5+uZcNn5R2M3mw+wTUJ+iIx3x+4HgnFsMsEJgjMEdgTmPOrX3WXc1PYE67mXyS0d9rutFuw8mFUC6T6ZW3o1E7FguF3rmjdHro9f1ey2U7nqVO4Cb1UK0arQRDloV5HgPG/dzWv0/cZbMDx/vJ5Mj641TK6AaFEEIIIYQQQgghhBBilpRpAjf3F8xiTxGBOQJzBOYIzBGY04v+//84BOYIzGnTBKb7C7x+CQnMaacTTru/YOs04fQtTOUbT4KATF8VMMwAAAAASUVORK5CYII="
  },
  {
    "id": "pastel-neutral-cotton-puff",
    "name": "Cotton Puff",
    "category": "neutral",
    "description": "Cotton Puff: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABhklEQVR4nO3aTUrDQBQH8P97HajnacCFZ2jWoqcoghQXQk4gPYKiVlynZ3AhpBsX4k0qpIyYhZAQMymTr+a9H4TJZKaPmYHMJM0QHGy6s/BA5oQwYAzhGMIxhGMIxxCOIRxDOHKt87/r+H91qsqO5TmBXRWqOujb+SEwdSoFp2el15P3Nxw7riydTHPZJElyaVmdUU+CX58fWD/dIwgCjIZNd7bO8fz4UHrue/TdfzqkEeuX1yy9vDhvrgE9rwIkfRmkpgNaa/0GhKjTAWEIxxCOIRylNvW6ZyeYYMhccwpDONNm8C22WTrDzFk3juNcPgxDdIEhHEM4hnAGQ7f/bjU8QzjTZvA6s3/faOf5Njct/CMURdHf+Xw+z9LNZlNaXpYvim5v0ObbJjU9AEObA1wDYIoXVnerXH5xtagsX14vvRqolFJKKaWUUkoppZRSXSLfAH3vL/DdU8QQjiEcQziGcAzhzNi//7swhGMIZ3wDpPvU6/d9b7NkCGeaDnjw/oJCedd+ACfI67axeQ/9AAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-neutral-lilac-puff",
    "name": "Lilac Puff",
    "category": "neutral",
    "description": "Lilac Puff: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABtklEQVR4nO3asUsCURwH8O/9fNNBUHG0GPkfWBSSu2JkS0NLg7S1i/0XBU5NjRYtQS0RgdJagUsODk1KU0RtTknRBYcn6SnP8677/T7L7929Hz/P5/neic+Ah8/3ly9oUPOLBkKMwByBOQJzBOYIzBGYIzBn6K7zuoJ+TiAwR+Mkl/YPXTHyAxCbW+hpx5FP5534V07k74DZ1S4e726QK+UQFTSss/vx6rRPT47tuLaSdNr9OZFfBc4vruy4u7MdmVXA8BqAnwsclDOs798MACasddvSGpDERmKqA0JgjsAcgTmjednU+s6apjmwbym5ZMf2UxtB8ZpTlJ8vHuQbH5Xys7hp/d4dnbeOZ271vuo6zqazmAYCcwTmCMwphFw8FfO1PoE55WfxUWb/oKlOR+8i+x+EypWy086sZ+xYe6g554qF4sD8Xo3nhh2PUgfwk1E/q2s9CVqWhTDPAV4/t1X/icp1xXVc2CoM7S/uuT9RIYQQQgghhBBCCCGECDNDt4Cf+wumsaeIwByBOQJzBOYIzKmo///vhcAcgTmlW0B3fwEwgyARmFOTLjju/oLlTX93gHj5Bufua3XYG6FjAAAAAElFTkSuQmCC"
  },
  {
    "id": "pastel-neutral-honey-comb",
    "name": "Honey Comb",
    "category": "neutral",
    "description": "Honey Comb: pastel neutral imported from custom skin folder",
    "model": "classic",
    "style": "pastel",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABmklEQVR4nO3aPUsDMRgH8H8eA0KlBZeOioujjn6D4uDL5uAu/QAiqIi4CYIfQNw7uPkyiJujQ4c6uhWc6iIWC04neuK1pe215NIr939+Sy6X8DQ52idpG4MYwWc9gAMzM28wwQTkBOQE5ATkBOQE5ATkjOs67zyAlPcJAnICcjKwNVdsu55D7fE4Knv1yVwOyBWBVqOz/qP7Xns9UzmgFU2scnUd1luN8LpHn8yvApW/iW9vbSY3gJTfAYZ9GTRJBww+Lt1+PyjsjPWBCMgJyAnImeDtzC0JTs/2b8svhmXzBWmJyynW66unOPFhWa/R8/mwbDZju94+1Drq66VljIOAnICcgJzFpJsqeQ0vIGe9Rh8i+6fN4usdSW6ETk5v/q/XVpd+y7v756j9YKNv/3bVaj1sP/L7ETDB66HbTrCwgEnOAXFft233jfOLp476bnllcPue5weglFJKKaWUUkoppZRSCTKuAbyeLxjDmSIBOQE5ATkBOQE5m/X//+MIyAnIWecIrucLckiVgJxNOuDI5wv2y0kPYSTfIpVkfACJnwcAAAAASUVORK5CYII="
  }
];
