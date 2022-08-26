const { network, ethers, deployments } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, use } from "chai";
import { Contract, BigNumber, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import { RandomNumberGenerator } from "../../typechain";

describe("PanCake Lottery ", function async() {
  let signers: Signer[];

  let lottery: Contract;
  let token: Contract;
  let randomNumberGenerator: Contract;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let MockRandomNumberGenerator: any;
  let MockERC20: any;
  let PancakeSwapLottery: any;

  // 200/10000 = 0.02
  // 300/10000 = 0.03
  // 500/10000 = 0.05
  let _rewardsBreakdown = ["200", "300", "500", "1500", "2500", "5000"];

  let _treasuryFee = "2000";

  let endTime = 1661563022;

  before(async () => {
    [owner, user, user2, user3] = await ethers.getSigners();

    hre.tracer.nameTags[owner.address] = "ADMIN";
    hre.tracer.nameTags[user.address] = "USER1";
    hre.tracer.nameTags[user2.address] = "USER2";

    MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Asad", "ASD", parseEther("100000"));

    MockRandomNumberGenerator = await ethers.getContractFactory("MockRandomNumberGenerator");
    randomNumberGenerator = await MockRandomNumberGenerator.deploy();

    PancakeSwapLottery = await ethers.getContractFactory("PancakeSwapLottery");
    lottery = await PancakeSwapLottery.deploy(token.address, randomNumberGenerator.address);

    await randomNumberGenerator.setLotteryAddress(lottery.address);
  });

  async function increaseTime(duration: number): Promise<void> {
    ethers.provider.send("evm_increaseTime", [duration]);
    ethers.provider.send("evm_mine", []);
  }

  it("sets up treasury/operator address", async function () {
    await expect(lottery.setOperatorAndTreasuryAndInjectorAddresses(owner.address, owner.address, owner.address))
      .to.emit(lottery, "NewOperatorAndTreasuryAndInjectorAddresses")
      .withArgs(owner.address, owner.address, owner.address);
    await token.connect(owner).mintTokens(parseEther("100000"));
    await token.connect(owner).approve(lottery.address, parseEther("100000"));
  });

  // it("Operator starts lottery With Less Time Of Minimum Limit", async () => {
  //   await expect(lottery.startLottery(1661501371, parseEther("1"), parseEther("0.5"), _rewardsBreakdown, _treasuryFee)).to.be.revertedWith(
  //     "Lottery length outside of range"
  //   );
  // });

  // 0.005 ether;
  it("Operator cannot start lottery if ticket price too low or too high", async () => {
    await expect(lottery.startLottery(endTime, 500, parseEther("0.5"), _rewardsBreakdown, _treasuryFee)).to.be.revertedWith("Outside of limits");
  });

  it("Operator cannot start lottery if discount divisor is too low", async () => {
    await expect(lottery.startLottery(endTime, parseEther("1"), 200, _rewardsBreakdown, _treasuryFee)).to.be.revertedWith("Discount divisor too low");
  });

  it("Operator cannot start lottery if discount divisor is too low", async () => {
    const _rewardsBreakdown = ["0", "300", "500", "1500", "2500", "5000"];

    await expect(lottery.startLottery(endTime, parseEther("1"), parseEther("0.5"), _rewardsBreakdown, _treasuryFee)).to.be.revertedWith(
      "Rewards must equal 10000"
    );
  });

  it("Operator cannot start lottery if treasury fee too high", async () => {
    await expect(lottery.startLottery(endTime, parseEther("1"), parseEther("0.5"), _rewardsBreakdown, 4000)).to.be.revertedWith("Treasury fee too high");
  });

  it("Operator cannot close lottery that is not started", async () => {
    await expect(lottery.closeLottery("2")).to.be.revertedWith("Lottery not open");
  });

  it("Start lottery", async () => {
    await lottery.startLottery(endTime, parseEther("1"), parseEther("0.5"), _rewardsBreakdown, _treasuryFee);
  });

  it("Start lottery 2", async () => {
    await expect(lottery.startLottery(endTime, parseEther("1"), parseEther("0.5"), _rewardsBreakdown, _treasuryFee)).to.revertedWith(
      "Not time to start lottery"
    );
  });

  it("Operator cannot close lottery", async () => {
    await expect(lottery.closeLottery("1")).to.be.revertedWith("Lottery not over");
  });

  it("Operator cannot close lottery", async () => {
    await expect(lottery.drawFinalNumberAndMakeLotteryClaimable("1", true)).to.be.revertedWith("Lottery not close");
  });

  it("User buys 1 ticket Without allowance", async () => {
    const _ticketsBought = ["1111111"];
    await expect(lottery.connect(user).buyTickets("1", _ticketsBought)).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("User buys 1 ticket Without allowance", async () => {
    const _ticketsBought = ["1111111"];
    await expect(lottery.connect(user).buyTickets("1", _ticketsBought)).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("Users mint and approve CAKE to be used in the lottery", async function () {
    for (let owner of [user, user2, user3]) {
      await token.connect(owner).mintTokens(parseEther("100000"));
      await token.connect(owner).approve(lottery.address, parseEther("100000"));
    }
  });

  it("User cannot buy 0 ticket", async () => {
    await expect(lottery.connect(user).buyTickets("1", [])).to.be.revertedWith("No ticket specified");
  });

  it("User cannot buy more than the limit of tickets per transaction", async () => {
    const _maxNumberTickets = "5"; // 6 --> rejected // 5 --> accepted
    await lottery.setMaxNumberTicketsPerBuy(_maxNumberTickets);

    await expect(lottery.buyTickets("2", ["1999999", "1999998", "1999999", "1999999", "1999998", "1999999"])).to.be.revertedWith("Too many tickets");
  });

  // array of ticket numbers between 1,000,000 and 1,999,999
  it("User buys 1 ticket ", async () => {
    const _ticketsBought = ["1111111"];
    await expect(lottery.connect(user).buyTickets("1", _ticketsBought)).to.emit(lottery, "TicketsPurchase").withArgs(user.address, "1", "1");
  });

  it("User cannot buy tickets if one of the numbers is outside of range", async () => {
    const _ticketsBought = ["2111111"];
    await expect(lottery.connect(user).buyTickets("1", _ticketsBought)).to.be.revertedWith("Outside range");
  });

  it("User cannot claim tickets if not over", async () => {
    await expect(lottery.claimTickets("1", ["1999995", "1569995"], ["1", "1"])).to.be.revertedWith("Lottery not claimable");
  });

  it("User2 buys 100 tickets", async () => {
    const _maxNumberTickets = "100"; // 6 --> rejected // 5 --> accepted
    await lottery.setMaxNumberTicketsPerBuy(_maxNumberTickets);
    const _ticketsBought = [
      "1234561",
      "1234562",
      "1234563",
      "1234564",
      "1234565",
      "1234566",
      "1234567",
      "1234568",
      "1234569",
      "1234570",
      "1334571",
      "1334572",
      "1334573",
      "1334574",
      "1334575",
      "1334576",
      "1334577",
      "1334578",
      "1334579",
      "1334580",
      "1434581",
      "1434582",
      "1434583",
      "1434584",
      "1434585",
      "1434586",
      "1434587",
      "1434588",
      "1434589",
      "1534590",
      "1534591",
      "1534592",
      "1534593",
      "1534594",
      "1534595",
      "1534596",
      "1534597",
      "1534598",
      "1534599",
      "1634600",
      "1634601",
      "1634602",
      "1634603",
      "1634604",
      "1634605",
      "1634606",
      "1634607",
      "1634608",
      "1634609",
      "1634610",
      "1634611",
      "1634612",
      "1634613",
      "1634614",
      "1634615",
      "1634616",
      "1634617",
      "1634618",
      "1634619",
      "1634620",
      "1634621",
      "1634622",
      "1634623",
      "1634624",
      "1634625",
      "1634626",
      "1634627",
      "1634628",
      "1634629",
      "1634630",
      "1634631",
      "1634632",
      "1634633",
      "1634634",
      "1634635",
      "1634636",
      "1634637",
      "1634638",
      "1634639",
      "1634640",
      "1634641",
      "1634642",
      "1634643",
      "1634644",
      "1634645",
      "1634646",
      "1634647",
      "1634648",
      "1634649",
      "1634650",
      "1634651",
      "1634652",
      "1634653",
      "1634654",
      "1634655",
      "1634656",
      "1634657",
      "1634658",
      "1634659",
      "1634660",
    ];

    await lottery.connect(user2).buyTickets("1", _ticketsBought);
  });

  it("User3 buys 10 tickets", async () => {
    const _ticketsBought = ["1111111", "1222222", "1333333", "1444444", "1555555", "1666666", "1777777", "1888888", "1000000", "1999999"];
    await lottery.connect(user3).buyTickets("1", _ticketsBought);
  });

  it("Owner does 10k CAKE injection", async () => {
    await expect(lottery.injectFunds("1", parseEther("10000")))
      .to.emit(lottery, "LotteryInjection")
      .withArgs("1", parseEther("10000"));
  });

  it("Close Lottery", async () => {
    await randomNumberGenerator.setNextRandomResult("1999999");

    increaseTime(96644);

    await expect(lottery.connect(user2).closeLottery("1")).to.be.revertedWith("Not operator");
    await expect(lottery.closeLottery("1")).to.emit(lottery, "LotteryClose").withArgs("1", "111");
  });

  it("Operator cannot draw numbers if the lotteryId isn't updated in RandomGenerator", async () => {
    await expect(lottery.drawFinalNumberAndMakeLotteryClaimable("1", false)).to.be.revertedWith("Numbers not drawn");

    await randomNumberGenerator.connect(owner).changeLatestLotteryId();

    await expect(lottery.drawFinalNumberAndMakeLotteryClaimable("1", true)).to.emit(lottery, "LotteryNumberDrawn").withArgs("1", "1999999", "11");
  });

  it("Cannot claim for wrong lottery (too high)", async () => {
    await expect(lottery.connect(user3).claimTickets("1", ["111"], ["5"])).to.be.revertedWith("TicketId too high");
  });

  it("User cannot claim a ticket with wrong bracket", async () => {
    await expect(lottery.connect(user3).claimTickets("1", ["110"], ["6"])).to.be.revertedWith("Bracket out of range");
    await expect(lottery.connect(user3).claimTickets("1", ["110"], ["4"])).to.be.revertedWith("No prize for this bracket");
    // await expect(lottery.connect(user3).claimTickets("1", ["110"], ["3"])).to.be.revertedWith("No prize for this bracket");
    await expect(lottery.connect(user3).claimTickets("1", ["110"], ["2"])).to.be.revertedWith("No prize for this bracket");
    // await expect(lottery.connect(user3).claimTickets("1", ["110"], ["1"])).to.be.revertedWith("No prize for this bracket");
    // await lottery.connect(user3).claimTickets("1", ["110"], ["1"]);
    await expect(lottery.connect(user3).claimTickets("1", ["110"], ["5"]))
      .to.emit(lottery, "TicketsClaim")
      .withArgs(user3.address, parseEther("4044.399999999999992008"), "1", "1");

    // totalcollectedCake * ((1-0.20) * bracketperPercentage)
    // (1-0.20) =  Burn = 20%
    // assume = bracket[5] = 5000/10000 = 0.5
    // 100053 *(0.8 * 0.5) = 10053  * 0.4 = 40% = 4021
  });

  it("User cannot claim twice a winning ticket", async () => {
    await expect(lottery.connect(user3).claimTickets("1", ["110"], ["5"])).to.be.revertedWith("Not the owner");
  });

  it("Start lottery 2", async () => {
    await lottery.startLottery(1661649422, parseEther("1"), parseEther("0.5"), _rewardsBreakdown, _treasuryFee);
  });

  it("User buys 1 ticket ", async () => {
    const _ticketsBought = ["1111111"];
    await lottery.connect(user).buyTickets("2", _ticketsBought);
  });
});
