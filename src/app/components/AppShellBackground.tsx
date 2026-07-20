import backgroundGradientImage from '../../assets/figma-home/background-gradient-77.png';

export function AppShellBackground() {
  return (
    <>
      <div className="absolute inset-0 bg-[#edeff1]" />
      <div className="absolute left-[-173.26px] top-[-322.21px] flex h-[449.416px] w-[667.526px] items-center justify-center">
        <div className="flex-none rotate-[-20.78deg]">
          <div className="h-[245px] w-[621px] rounded-[442.244px] bg-[#3385ff] opacity-20 blur-[106.822px]" />
        </div>
      </div>
      <div className="absolute left-[-128.35px] top-[522.31px] flex h-[421.474px] w-[541.695px] items-center justify-center">
        <div className="flex-none rotate-[24.52deg]">
          <div className="h-[242px] w-[485px] rounded-[347.786px] bg-[#ffac4b] opacity-[0.21] blur-[107.563px]" />
        </div>
      </div>
      <div className="absolute left-[975px] -top-[135px] h-[271px] w-[485px] rounded-[485px] bg-[#7357ff] opacity-10 blur-[150px]" />
      <div className="absolute bottom-0 right-0 flex h-[979px] w-[1727px] items-center justify-center">
        <div className="flex-none rotate-180 -scale-y-100">
          <div className="relative h-[979px] w-[1727px] opacity-20 blur-[100px]">
            <img
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-cover"
              src={backgroundGradientImage}
              alt=""
            />
          </div>
        </div>
      </div>
    </>
  );
}
